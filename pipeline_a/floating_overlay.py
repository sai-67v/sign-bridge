from PyQt6.QtWidgets import QWidget, QLabel, QVBoxLayout
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

class FloatingSubtitle(QWidget):
    def __init__(self):
        super().__init__()
        # Frameless, Always on Top, Tool window, Transparent for Input
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | 
                            Qt.WindowType.WindowStaysOnTopHint | 
                            Qt.WindowType.Tool | 
                            Qt.WindowType.WindowTransparentForInput)
        
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        self.label = QLabel("Subtitles initializing...")
        self.label.setFont(QFont("Arial", 24, QFont.Weight.Bold))
        self.label.setStyleSheet("color: white; background-color: rgba(0, 0, 0, 150); padding: 10px; border-radius: 10px;")
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        layout = QVBoxLayout()
        layout.addWidget(self.label)
        self.setLayout(layout)
        
        # Default positioning (bottom center)
        self.setGeometry(200, 800, 1520, 100)

    def update_text(self, text: str):
        self.label.setText(text)
        self.label.adjustSize()
        self.adjustSize()
