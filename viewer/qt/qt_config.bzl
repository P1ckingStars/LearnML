# Auto-detected Qt6 configuration.
# Regenerate with: pkg-config --cflags/--libs Qt6Core Qt6Gui Qt6Widgets Qt6WebEngineWidgets

QT_COPTS = [
    "-isystem/usr/include/qt6",
    "-isystem/usr/include/qt6/QtCore",
    "-isystem/usr/include/qt6/QtGui",
    "-isystem/usr/include/qt6/QtWidgets",
    "-isystem/usr/include/qt6/QtWebEngineCore",
    "-isystem/usr/include/qt6/QtWebEngineWidgets",
    "-isystem/usr/include/qt6/QtWebChannel",
    "-isystem/usr/include/qt6/QtQml",
    "-isystem/usr/include/qt6/QtNetwork",
    "-isystem/usr/include/qt6/QtOpenGL",
    "-isystem/usr/include/qt6/QtQuick",
    "-isystem/usr/include/qt6/QtPositioning",
    "-isystem/usr/include/qt6/QtPrintSupport",
    "-isystem/usr/include/qt6/QtQmlIntegration",
    "-DQT_CORE_LIB",
    "-DQT_GUI_LIB",
    "-DQT_WIDGETS_LIB",
    "-DQT_WEBENGINECORE_LIB",
    "-DQT_WEBENGINEWIDGETS_LIB",
    "-DQT_WEBCHANNEL_LIB",
    "-DQT_QML_LIB",
    "-DQT_QMLINTEGRATION_LIB",
    "-DQT_NETWORK_LIB",
    "-DQT_OPENGL_LIB",
    "-DQT_QUICK_LIB",
    "-DQT_POSITIONING_LIB",
    "-DQT_PRINTSUPPORT_LIB",
    "-fPIC",
]

QT_LINKOPTS = [
    "-lQt6WebEngineWidgets",
    "-lQt6WebEngineCore",
    "-lQt6Quick",
    "-lQt6OpenGL",
    "-lQt6WebChannel",
    "-lQt6Qml",
    "-lQt6Network",
    "-lQt6Positioning",
    "-lQt6PrintSupport",
    "-lQt6Widgets",
    "-lQt6Gui",
    "-lQt6Core",
]

QT_MOC = "/usr/lib/qt6/moc"
QT_RCC = "/usr/lib/qt6/rcc"

QT_MOC_FLAGS = " ".join([
    "-I/usr/include/qt6",
    "-I/usr/include/qt6/QtCore",
    "-I/usr/include/qt6/QtGui",
    "-I/usr/include/qt6/QtWidgets",
    "-I/usr/include/qt6/QtWebEngineCore",
    "-I/usr/include/qt6/QtWebEngineWidgets",
])
