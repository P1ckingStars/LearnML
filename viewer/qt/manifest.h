#pragma once

#include <QDir>
#include <QString>
#include <QVector>

struct Page {
    QString path;
    QString title;
};

struct Node {
    QString title;
    QVector<Page> pages;
    QVector<Node> children;
};

class Manifest {
public:
    void build(const QString &contentDir);

    const Node &root() const { return m_root; }
    const QVector<Page> &flatOrder() const { return m_flatOrder; }

private:
    static QString extractTitle(const QString &filePath);
    static QString prettyName(const QString &filename);
    Node scanDir(const QString &contentDir, const QDir &dir,
                 const QString &relPrefix);

    Node m_root;
    QVector<Page> m_flatOrder;
};
