#include "manifest.h"
#include <QFile>
#include <QFileInfo>
#include <QRegularExpression>
#include <QTextStream>

QString Manifest::extractTitle(const QString &filePath)
{
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text))
        return {};

    QTextStream stream(&file);
    QString firstLine = stream.readLine();

    // Check for YAML frontmatter (starts with "---")
    if (firstLine.trimmed() == QLatin1String("---")) {
        while (!stream.atEnd()) {
            const QString line = stream.readLine();
            if (line.trimmed() == QLatin1String("---"))
                break; // end of frontmatter
            if (line.trimmed().startsWith(QLatin1String("title:"))) {
                QString title = line.trimmed().mid(6).trimmed();
                if (title.startsWith('"') && title.endsWith('"'))
                    title = title.mid(1, title.length() - 2);
                if (!title.isEmpty())
                    return title;
            }
        }
    }

    // Fallback: scan for first # heading (check the line we already read too)
    auto tryHeading = [](const QString &line) -> QString {
        static const QRegularExpression hRe(
            QStringLiteral("^#\\s+(.+)$"));
        const auto m = hRe.match(line);
        return m.hasMatch() ? m.captured(1) : QString();
    };

    if (const QString h = tryHeading(firstLine); !h.isEmpty())
        return h;

    for (int i = 0; i < 50 && !stream.atEnd(); ++i) {
        if (const QString h = tryHeading(stream.readLine()); !h.isEmpty())
            return h;
    }

    return {};
}

QString Manifest::prettyName(const QString &filename)
{
    static const QRegularExpression mdSuffix(QStringLiteral("\\.md$"));
    static const QRegularExpression separators(QStringLiteral("[_-]"));

    QString name = filename;
    name.replace(mdSuffix, QString());
    name.replace(separators, QStringLiteral(" "));
    QStringList words = name.split(' ', Qt::SkipEmptyParts);
    for (auto &w : words) {
        if (!w.isEmpty())
            w[0] = w[0].toUpper();
    }
    return words.join(' ');
}

Node Manifest::scanDir(const QString &contentDir, const QDir &dir,
                        const QString &relPrefix)
{
    Node node;

    // Title: try extracting from README, fallback to pretty dirname
    const QString readmePath = dir.filePath(QStringLiteral("README.md"));
    node.title = extractTitle(readmePath);
    if (node.title.isEmpty())
        node.title = prettyName(dir.dirName());

    // Markdown files in this directory (alphabetical)
    const QStringList files = dir.entryList(
        {QStringLiteral("*.md")}, QDir::Files, QDir::Name);
    for (const auto &f : files) {
        const QString relPath = relPrefix + f;
        const QString absPath = QDir(contentDir).filePath(relPath);
        QString title = extractTitle(absPath);
        if (title.isEmpty())
            title = prettyName(f);
        Page page{relPath, title};
        m_flatOrder.append(page);
        node.pages.append(std::move(page));
    }

    // Subdirectories (alphabetical), skipping hidden dirs and symlinks
    const QStringList subdirs = dir.entryList(
        QDir::Dirs | QDir::NoDotAndDotDot, QDir::Name);
    for (const auto &sub : subdirs) {
        if (sub.startsWith('.'))
            continue;
        if (QFileInfo(dir.filePath(sub)).isSymLink())
            continue;

        Node child = scanDir(contentDir, QDir(dir.filePath(sub)),
                              relPrefix + sub + '/');
        if (!child.pages.isEmpty() || !child.children.isEmpty())
            node.children.append(std::move(child));
    }

    return node;
}

void Manifest::build(const QString &contentDir)
{
    m_flatOrder.clear();
    m_root = scanDir(contentDir, QDir(contentDir), QString());
}
