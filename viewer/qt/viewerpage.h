#pragma once

#include <QWebEnginePage>
#include <QUrl>

class ViewerPage : public QWebEnginePage {
    Q_OBJECT
public:
    using QWebEnginePage::QWebEnginePage;

signals:
    void linkRequested(const QString &pagePath, const QString &anchor);
    void nextRequested();
    void prevRequested();
    void focusTreeRequested();

protected:
    bool acceptNavigationRequest(const QUrl &url, NavigationType type,
                                 bool isMainFrame) override;
};
