#include "mainwindow.h"
#include "viewerpage.h"
#include <QDir>
#include <QFile>
#include <QFont>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonValue>
#include <QKeyEvent>
#include <QShortcut>
#include <QSplitter>
#include <QTreeWidget>
#include <QWebEngineSettings>
#include <QWebEngineView>

// --- MainWindow ---

MainWindow::MainWindow(const QString &contentDir, QWidget *parent)
    : QMainWindow(parent), m_contentDir(contentDir)
{
    m_manifest.build(contentDir);
    buildUI();
    buildTree();

    // Build path -> flat index map
    const auto &pages = m_manifest.flatOrder();
    for (int i = 0; i < pages.size(); ++i)
        m_pathToIndex[pages[i].path] = i;

    // Keyboard shortcuts
    auto *nextSc = new QShortcut(QKeySequence(Qt::ALT | Qt::Key_Right), this);
    connect(nextSc, &QShortcut::activated, this, &MainWindow::navigateNext);
    auto *prevSc = new QShortcut(QKeySequence(Qt::ALT | Qt::Key_Left), this);
    connect(prevSc, &QShortcut::activated, this, &MainWindow::navigatePrev);

    // Load HTML template; render first page when ready
    connect(m_webView, &QWebEngineView::loadFinished,
            this, &MainWindow::onPageLoaded);
    m_webView->setUrl(QUrl(QStringLiteral("qrc:/viewer/viewer.html")));

    if (!pages.isEmpty())
        m_pendingIndex = 0;
}

void MainWindow::buildUI()
{
    resize(1200, 800);
    setWindowTitle(QStringLiteral("mdbook-viewer"));

    m_splitter = new QSplitter(this);
    setCentralWidget(m_splitter);

    // Sidebar tree
    m_tree = new QTreeWidget(m_splitter);
    m_tree->setHeaderHidden(true);
    m_tree->setIndentation(16);
    m_tree->setMinimumWidth(260);
    m_tree->setMaximumWidth(400);
    m_tree->setFocusPolicy(Qt::StrongFocus);
    m_tree->installEventFilter(this);
    connect(m_tree, &QTreeWidget::itemClicked,
            this, &MainWindow::onTreeItemClicked);
    connect(m_tree, &QTreeWidget::itemActivated,
            this, &MainWindow::onTreeItemClicked);

    // Content web view
    m_viewerPage = new ViewerPage(this);
    m_webView = new QWebEngineView(m_splitter);
    m_webView->setPage(m_viewerPage);
    m_webView->settings()->setAttribute(
        QWebEngineSettings::LocalContentCanAccessRemoteUrls, true);
    connect(m_viewerPage, &ViewerPage::linkRequested,
            this, &MainWindow::onLinkRequested);
    connect(m_viewerPage, &ViewerPage::nextRequested,
            this, &MainWindow::navigateNext);
    connect(m_viewerPage, &ViewerPage::prevRequested,
            this, &MainWindow::navigatePrev);
    connect(m_viewerPage, &ViewerPage::focusTreeRequested,
            this, &MainWindow::focusTree);

    m_splitter->setStretchFactor(0, 0);
    m_splitter->setStretchFactor(1, 1);
    m_splitter->setSizes({280, 920});
}

void MainWindow::buildTree()
{
    int flatIdx = 0;
    const auto &root = m_manifest.root();

    // Root-level pages (e.g. README.md at the content root)
    for (const auto &page : root.pages) {
        auto *item = new QTreeWidgetItem(m_tree);
        item->setText(0, page.title);
        item->setData(0, Qt::UserRole, flatIdx);
        m_indexToItem[flatIdx] = item;
        flatIdx++;
    }

    // Root-level subdirectories
    for (const auto &child : root.children)
        buildTreeNode(child, nullptr, flatIdx);
}

void MainWindow::buildTreeNode(const Node &node, QTreeWidgetItem *parent,
                                int &flatIdx)
{
    auto *item = parent
        ? new QTreeWidgetItem(parent)
        : new QTreeWidgetItem(m_tree);
    item->setText(0, node.title);
    item->setFlags(item->flags() & ~Qt::ItemIsSelectable);
    QFont f = item->font(0);
    f.setBold(true);
    item->setFont(0, f);
    item->setExpanded(parent == nullptr);

    for (const auto &page : node.pages) {
        auto *pageItem = new QTreeWidgetItem(item);
        pageItem->setText(0, page.title);
        pageItem->setData(0, Qt::UserRole, flatIdx);
        m_indexToItem[flatIdx] = pageItem;
        flatIdx++;
    }

    for (const auto &child : node.children)
        buildTreeNode(child, item, flatIdx);
}

void MainWindow::renderPage(int index)
{
    const auto &pages = m_manifest.flatOrder();
    if (index < 0 || index >= pages.size())
        return;
    if (!m_pageReady) {
        m_pendingIndex = index;
        return;
    }

    const auto &page = pages[index];
    QFile file(QDir(m_contentDir).filePath(page.path));
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text))
        return;
    const QString raw = QString::fromUtf8(file.readAll());

    // JSON-encode [raw, pagePath] for safe JS injection
    QJsonArray arr;
    arr.append(raw);
    arr.append(page.path);
    const QString json = QString::fromUtf8(
        QJsonDocument(arr).toJson(QJsonDocument::Compact));

    m_webView->page()->runJavaScript(
        QStringLiteral("window.renderPage(%1)").arg(json));

    m_currentIndex = index;

    // Update tree selection
    if (auto it = m_indexToItem.constFind(index); it != m_indexToItem.constEnd()) {
        m_tree->blockSignals(true);
        m_tree->setCurrentItem(it.value());
        m_tree->scrollToItem(it.value());
        m_tree->blockSignals(false);
    }

    setWindowTitle(page.title + QStringLiteral(" \u2014 LearnML"));
}

void MainWindow::scrollToAnchor(const QString &anchor)
{
    if (anchor.isEmpty())
        return;
    // JSON-encode the anchor for safe JS injection.
    // Wrap in a single-element array to get a valid JSON document, then
    // extract just the string literal (with quotes) from the output.
    const QByteArray json =
        QJsonDocument(QJsonArray{anchor}).toJson(QJsonDocument::Compact);
    // json is e.g. '["some-heading"]' — strip the surrounding [ and ]
    const QString encoded = QString::fromUtf8(json.mid(1, json.size() - 2));
    m_webView->page()->runJavaScript(QStringLiteral(
        "document.getElementById(%1)"
        "?.scrollIntoView({behavior:'smooth'})").arg(encoded));
}

void MainWindow::onPageLoaded(bool ok)
{
    if (!ok)
        return;
    m_pageReady = true;
    if (m_pendingIndex >= 0) {
        renderPage(m_pendingIndex);
        m_pendingIndex = -1;
    }
}

void MainWindow::onTreeItemClicked(QTreeWidgetItem *item, int)
{
    const QVariant data = item->data(0, Qt::UserRole);
    if (data.isValid())
        renderPage(data.toInt());
}

void MainWindow::onLinkRequested(const QString &pagePath, const QString &anchor)
{
    if (auto it = m_pathToIndex.constFind(pagePath); it != m_pathToIndex.constEnd()) {
        renderPage(it.value());
        scrollToAnchor(anchor);
    }
}

void MainWindow::navigateNext()
{
    if (m_currentIndex < 0 || !m_pageReady)
        return;
    if (m_currentIndex < m_manifest.flatOrder().size() - 1)
        renderPage(m_currentIndex + 1);
}

void MainWindow::navigatePrev()
{
    if (m_currentIndex < 0 || !m_pageReady)
        return;
    if (m_currentIndex > 0)
        renderPage(m_currentIndex - 1);
}

void MainWindow::focusTree()
{
    m_tree->setFocus();
    // Ensure something is selected so arrow keys work immediately
    if (!m_tree->currentItem() && m_tree->topLevelItemCount() > 0)
        m_tree->setCurrentItem(m_tree->topLevelItem(0));
}

void MainWindow::focusContent()
{
    m_webView->setFocus();
}

bool MainWindow::eventFilter(QObject *obj, QEvent *event)
{
    if (obj == m_tree && event->type() == QEvent::KeyPress) {
        auto *ke = static_cast<QKeyEvent *>(event);
        const int key = ke->key();

        // Escape or Tab — return focus to content
        if (key == Qt::Key_Escape || key == Qt::Key_Tab) {
            focusContent();
            return true;
        }
        // j — move down
        if (key == Qt::Key_J) {
            auto *next = m_tree->itemBelow(m_tree->currentItem());
            if (next) m_tree->setCurrentItem(next);
            return true;
        }
        // k — move up
        if (key == Qt::Key_K) {
            auto *prev = m_tree->itemAbove(m_tree->currentItem());
            if (prev) m_tree->setCurrentItem(prev);
            return true;
        }
        // l — expand node or open page and return to content
        if (key == Qt::Key_L) {
            auto *item = m_tree->currentItem();
            if (!item) return true;
            if (item->childCount() > 0) {
                item->setExpanded(true);
            } else {
                const QVariant data = item->data(0, Qt::UserRole);
                if (data.isValid()) {
                    renderPage(data.toInt());
                    focusContent();
                }
            }
            return true;
        }
        // h — collapse node or move to parent
        if (key == Qt::Key_H) {
            auto *item = m_tree->currentItem();
            if (!item) return true;
            if (item->isExpanded() && item->childCount() > 0) {
                item->setExpanded(false);
            } else if (item->parent()) {
                m_tree->setCurrentItem(item->parent());
            } else {
                focusContent();
            }
            return true;
        }
        // Enter/Return — open page and return to content
        if (key == Qt::Key_Return || key == Qt::Key_Enter) {
            auto *item = m_tree->currentItem();
            if (!item) return true;
            const QVariant data = item->data(0, Qt::UserRole);
            if (data.isValid()) {
                renderPage(data.toInt());
                focusContent();
            } else {
                // Toggle expand on non-page nodes
                item->setExpanded(!item->isExpanded());
            }
            return true;
        }
    }
    return QMainWindow::eventFilter(obj, event);
}
