# Recitation 08: Implementing a Garbage Collector

## Overview

This recitation guides you through building a garbage collector from scratch: first a mark-and-sweep collector for a simple runtime, then adding generational support, followed by performance measurement and tuning. By the end, you will have a working GC capable of managing memory for a simple programming language runtime.

**Prerequisites:** Understanding of mark-and-sweep and generational GC algorithms (Lectures 08a--08b), basic C or C++ programming.

---

## Exercise 1: Building a Mark-and-Sweep Collector

### 1.1 The Simple Runtime

We implement a GC for a simple object model:

```c
// Object types
typedef enum { OBJ_INT, OBJ_PAIR, OBJ_STRING } ObjType;

// Object header
typedef struct Object {
    ObjType type;
    unsigned char marked;        // GC mark bit
    struct Object* next;         // intrusive list of all objects (for sweep)
    // Payload follows
} Object;

typedef struct {
    Object header;
    int value;
} ObjInt;

typedef struct {
    Object header;
    Object* head;
    Object* tail;
} ObjPair;

typedef struct {
    Object header;
    int length;
    char data[];               // flexible array member
} ObjString;
```

### 1.2 The VM State

```c
#define STACK_MAX 256
#define GC_THRESHOLD 64    // collect when numObjects >= threshold

typedef struct {
    Object* stack[STACK_MAX];
    int stackSize;

    Object* allObjects;     // linked list of all allocated objects
    int numObjects;
    int gcThreshold;
} VM;
```

### 1.3 Allocation

```c
Object* allocate(VM* vm, ObjType type, size_t size) {
    if (vm->numObjects >= vm->gcThreshold) {
        gc(vm);
    }

    Object* obj = (Object*)malloc(size);
    obj->type = type;
    obj->marked = 0;

    // Add to allObjects list
    obj->next = vm->allObjects;
    vm->allObjects = obj;
    vm->numObjects++;

    return obj;
}

ObjInt* newInt(VM* vm, int value) {
    ObjInt* obj = (ObjInt*)allocate(vm, OBJ_INT, sizeof(ObjInt));
    obj->value = value;
    return obj;
}

ObjPair* newPair(VM* vm, Object* head, Object* tail) {
    ObjPair* obj = (ObjPair*)allocate(vm, OBJ_PAIR, sizeof(ObjPair));
    obj->head = head;
    obj->tail = tail;
    return obj;
}
```

### 1.4 Mark Phase

```c
void mark(Object* obj) {
    if (obj == NULL || obj->marked) return;

    obj->marked = 1;

    // Recursively mark children
    switch (obj->type) {
        case OBJ_INT:
        case OBJ_STRING:
            break;  // no pointer fields
        case OBJ_PAIR: {
            ObjPair* pair = (ObjPair*)obj;
            mark(pair->head);
            mark(pair->tail);
            break;
        }
    }
}

void markAll(VM* vm) {
    // Mark from roots (the stack)
    for (int i = 0; i < vm->stackSize; i++) {
        mark(vm->stack[i]);
    }
}
```

### 1.5 Sweep Phase

```c
void sweep(VM* vm) {
    Object** obj = &vm->allObjects;
    while (*obj) {
        if (!(*obj)->marked) {
            // Unreachable: remove from list and free
            Object* garbage = *obj;
            *obj = garbage->next;
            free(garbage);
            vm->numObjects--;
        } else {
            // Reachable: clear mark for next cycle
            (*obj)->marked = 0;
            obj = &(*obj)->next;
        }
    }
}
```

### 1.6 The GC Entry Point

```c
void gc(VM* vm) {
    int before = vm->numObjects;

    markAll(vm);
    sweep(vm);

    // Adaptive threshold: grow if many objects survive
    vm->gcThreshold = vm->numObjects * 2;
    if (vm->gcThreshold < GC_THRESHOLD)
        vm->gcThreshold = GC_THRESHOLD;

    printf("GC: %d objects before, %d after, threshold now %d\n",
           before, vm->numObjects, vm->gcThreshold);
}
```

### 1.7 Task

Implement the above collector in C (or your language of choice). Write test cases:

**(a)** Allocate many objects, keep some on the stack, verify that unreferenced objects are collected.

**(b)** Create a cycle (pair A pointing to pair B, pair B pointing to pair A). Remove stack references to both. Verify the cycle is collected.

**(c)** Stress test: allocate 10,000 objects in a loop, keeping only the last 10 alive. Verify that memory usage stays bounded.

---

## Exercise 2: Adding Generational Support

### 2.1 Design

Extend the collector with a simple two-generation scheme:

- **Young generation**: a bump-pointer allocated region of fixed size (e.g., 64 KB).
- **Old generation**: the existing malloc-based heap.
- **Promotion**: young objects that survive a minor collection are promoted to the old generation.
- **Remembered set**: track old-to-young pointers for minor collection roots.

### 2.2 Young Generation Allocation

```c
#define YOUNG_SIZE (64 * 1024)  // 64 KB nursery

typedef struct {
    char space[YOUNG_SIZE];
    char* free;               // bump pointer
    char* end;                // end of nursery
} YoungGen;

Object* youngAllocate(VM* vm, ObjType type, size_t size) {
    if (vm->young.free + size > vm->young.end) {
        minorGC(vm);          // collect young generation
        if (vm->young.free + size > vm->young.end) {
            // Still no space: allocate directly in old gen
            return allocate(vm, type, size);
        }
    }

    Object* obj = (Object*)vm->young.free;
    vm->young.free += size;

    obj->type = type;
    obj->marked = 0;
    obj->generation = YOUNG;
    obj->next = NULL;         // not on allObjects list yet
    vm->numYoungObjects++;

    return obj;
}
```

### 2.3 Write Barrier

```c
void writeBarrier(VM* vm, Object* parent, Object** field, Object* child) {
    *field = child;

    // If parent is old and child is young, record in remembered set
    if (parent->generation == OLD && child != NULL &&
        child->generation == YOUNG) {
        rememberedSetAdd(vm, parent);
    }
}
```

### 2.4 Minor Collection

```c
void minorGC(VM* vm) {
    // Roots = stack roots + remembered set
    // Mark young objects reachable from roots
    // Promote survivors to old generation
    // Reset nursery bump pointer

    for (int i = 0; i < vm->stackSize; i++) {
        if (vm->stack[i] && vm->stack[i]->generation == YOUNG) {
            vm->stack[i] = promote(vm, vm->stack[i]);
        }
    }

    // Process remembered set
    for (int i = 0; i < vm->remSetSize; i++) {
        Object* old = vm->remSet[i];
        // Scan old object's fields; promote any young referents
        promoteChildren(vm, old);
    }

    // Reset nursery
    vm->young.free = vm->young.space;
    vm->numYoungObjects = 0;
    vm->remSetSize = 0;
}

Object* promote(VM* vm, Object* young) {
    if (young->generation == OLD) return young;  // already promoted
    if (young->forwarded) return young->forwardingPtr;

    // Copy to old generation
    size_t size = objectSize(young);
    Object* old = (Object*)malloc(size);
    memcpy(old, young, size);
    old->generation = OLD;
    old->next = vm->allObjects;
    vm->allObjects = old;
    vm->numObjects++;

    // Install forwarding pointer
    young->forwarded = 1;
    young->forwardingPtr = old;

    // Recursively update/promote children
    promoteChildren(vm, old);

    return old;
}
```

### 2.5 Task

**(a)** Implement the generational extension. Verify that minor collections correctly promote survivors and reset the nursery.

**(b)** Write a test that creates many short-lived objects (simulating functional programming allocation patterns). Measure how many minor vs major collections occur.

**(c)** Verify that the write barrier correctly handles old-to-young pointers: create an old object, then store a young object reference into it. Run a minor collection and verify the young object is promoted (not lost).

---

## Exercise 3: Measuring GC Performance

### 3.1 Metrics

Implement timing and counting instrumentation:

```c
typedef struct {
    int minorCollections;
    int majorCollections;
    int totalObjectsAllocated;
    int totalObjectsCollected;
    int totalBytesAllocated;
    int totalBytesCollected;
    double totalGCTime;        // seconds
    double maxPauseTime;       // seconds
} GCStats;
```

### 3.2 Benchmarks

Run the following benchmarks and report GC statistics:

**(a) Allocation-heavy benchmark:**
```
for i = 1 to 1,000,000:
    p = newPair(newInt(i), newInt(i+1))
    // p goes out of scope each iteration
```
Expected: nearly 100% death rate, minor collections dominate.

**(b) Long-lived data benchmark:**
```
list = null
for i = 1 to 100,000:
    list = newPair(newInt(i), list)   // growing linked list
```
Expected: nearly 0% death rate in young gen, frequent promotions, eventually a major collection.

**(c) Mixed benchmark:**
```
cache = array of 100 entries
for i = 1 to 1,000,000:
    temp = newPair(newInt(i), newInt(i*2))    // short-lived
    cache[i % 100] = newPair(newInt(i), null) // long-lived (100 at a time)
```

### 3.3 Metrics to Report

For each benchmark:

| Metric | Value |
|--------|-------|
| Total objects allocated | |
| Total objects collected | |
| Minor collections | |
| Major collections | |
| Total GC time (ms) | |
| Average minor GC pause (ms) | |
| Maximum pause (ms) | |
| Survival rate (young gen) | |
| Promotion rate | |

---

## Exercise 4: Tuning GC Parameters

### 4.1 Parameters to Tune

Experiment with the following parameters and measure their impact:

1. **Nursery size**: try 8 KB, 64 KB, 256 KB, 1 MB. Plot minor GC frequency and pause time vs nursery size.

2. **GC threshold multiplier**: after a major GC, set the next threshold to $k \times \text{live objects}$ for $k \in \{1.5, 2, 3, 4\}$. Measure total GC time vs peak memory usage.

3. **Promotion threshold**: promote after $n$ surviving collections (tenuring threshold). Try $n \in \{1, 2, 4, 8\}$.

### 4.2 Analysis Questions

**(a)** How does nursery size affect the survival rate? Why?

**(b)** What is the relationship between GC threshold multiplier and total GC time? Is there a diminishing return?

**(c)** For the mixed benchmark, what tenuring threshold minimizes total GC time?

### 4.3 Expected Observations

- **Larger nursery**: fewer minor GCs but each takes longer (more to scan). Higher survival rate per collection (short-lived objects have more time to die between collections).
- **Higher threshold multiplier**: less frequent major GCs, but higher peak memory usage.
- **Higher tenuring threshold**: prevents premature promotion of "medium-lived" objects, but risks nursery overflow if many objects survive.

---

## Exercise 5: Discussion Questions

1. Why is bump-pointer allocation in the nursery faster than `malloc`? Quantify the difference (in terms of instructions per allocation).

2. The recursive `mark()` function uses $O(d)$ stack space where $d$ is the object graph depth. For a linked list of 1 million nodes, this could overflow the C stack. Propose two solutions and discuss their tradeoffs.

3. Our write barrier checks `parent->generation == OLD && child->generation == YOUNG` on every pointer write. In a real system, what fraction of pointer writes trigger the barrier, and what is the overhead? How does card marking reduce this overhead?

4. Why does the generational hypothesis hold for most programs? Give an example of a program where it does *not* hold and discuss how the GC would perform.

---

## Summary

Building a GC from scratch provides deep understanding of the tradeoffs involved:

- **Mark-and-sweep** is simple but pauses proportional to heap size.
- **Generational collection** exploits the generational hypothesis for dramatic performance improvement.
- **Write barriers** are essential for generational correctness but add per-write overhead.
- **Tuning** GC parameters requires understanding the application's allocation behavior.

These exercises form the foundation for the HW8 implementation project, where you will build a more complete collector with copying semantics.
