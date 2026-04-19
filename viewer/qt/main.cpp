#include <QApplication>
#include <QDir>
#include <QCommandLineParser>
#include "mainwindow.h"

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    app.setApplicationName("mdbook-viewer");
    app.setOrganizationName("LearnML");

    QCommandLineParser parser;
    parser.setApplicationDescription("View-only book reader for markdown directories with math and code rendering");
    parser.addHelpOption();
    parser.addPositionalArgument("directory", "Content directory to view");
    parser.process(app);

    const QStringList args = parser.positionalArguments();
    if (args.isEmpty()) {
        qCritical("Usage: viewer <content-directory>");
        return 1;
    }

    QString contentDir = QDir(args.first()).absolutePath();
    if (!QDir(contentDir).exists()) {
        qCritical("Directory not found: %s", qPrintable(contentDir));
        return 1;
    }

    MainWindow window(contentDir);
    window.show();
    return app.exec();
}
