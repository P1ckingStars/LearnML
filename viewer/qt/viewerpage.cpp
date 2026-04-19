#include "viewerpage.h"
#include <QDesktopServices>

bool ViewerPage::acceptNavigationRequest(const QUrl &url, NavigationType,
                                          bool)
{
    const QString scheme = url.scheme();

    // Vim navigation commands from JavaScript
    if (scheme == QLatin1String("cmd")) {
        const QString cmd = url.path();
        if (cmd == QLatin1String("next"))
            emit nextRequested();
        else if (cmd == QLatin1String("prev"))
            emit prevRequested();
        else if (cmd == QLatin1String("focus-tree"))
            emit focusTreeRequested();
        return false;
    }

    // Internal page link — extract path and fragment via QUrl API
    if (scheme == QLatin1String("md")) {
        emit linkRequested(url.path(), url.fragment());
        return false;
    }

    // Allow loading the initial qrc page and its sub-resources
    if (scheme == QLatin1String("qrc") || scheme == QLatin1String("data"))
        return true;

    // Open external links in the system browser
    if (scheme == QLatin1String("http") || scheme == QLatin1String("https")) {
        QDesktopServices::openUrl(url);
        return false;
    }

    // Block everything else
    return false;
}
