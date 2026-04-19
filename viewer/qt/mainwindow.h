#pragma once

#include <QMainWindow>
#include <QMap>

class QSplitter;
class QTreeWidget;
class QTreeWidgetItem;
class QWebEngineView;
class ViewerPage;

#include "manifest.h"

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(const QString &contentDir, QWidget *parent = nullptr);

private slots:
    void onTreeItemClicked(QTreeWidgetItem *item, int column);
    void onPageLoaded(bool ok);
    void onLinkRequested(const QString &pagePath, const QString &anchor);
    void navigateNext();
    void navigatePrev();

private:
    void buildUI();
    void buildTree();
    void buildTreeNode(const Node &node, QTreeWidgetItem *parent, int &flatIdx);
    void renderPage(int index);
    void scrollToAnchor(const QString &anchor);
    void focusTree();
    void focusContent();
    bool eventFilter(QObject *obj, QEvent *event) override;

    QString m_contentDir;
    Manifest m_manifest;
    int m_currentIndex = -1;
    bool m_pageReady = false;
    int m_pendingIndex = -1;

    QSplitter *m_splitter = nullptr;
    QTreeWidget *m_tree = nullptr;
    QWebEngineView *m_webView = nullptr;
    ViewerPage *m_viewerPage = nullptr;
    QMap<QString, int> m_pathToIndex;
    QMap<int, QTreeWidgetItem *> m_indexToItem;
};
