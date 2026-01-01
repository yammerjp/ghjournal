import UIKit

public class TextCursorCalculator {

  /// タップ座標から文字インデックスを計算する
  /// - Parameters:
  ///   - text: テキスト内容
  ///   - x: タップX座標（コンテナ内）
  ///   - y: タップY座標（コンテナ内）
  ///   - fontSize: フォントサイズ
  ///   - lineHeight: 行の高さ
  ///   - containerWidth: コンテナの幅
  /// - Returns: 文字インデックス
  public static func getCharacterIndex(
    text: String,
    x: CGFloat,
    y: CGFloat,
    fontSize: CGFloat,
    lineHeight: CGFloat,
    containerWidth: CGFloat
  ) -> Int {
    guard !text.isEmpty else { return 0 }

    // TextKitのセットアップ
    let textStorage = NSTextStorage(string: text)
    let layoutManager = NSLayoutManager()
    let textContainer = NSTextContainer(size: CGSize(width: containerWidth, height: .greatestFiniteMagnitude))

    textContainer.lineFragmentPadding = 0
    textStorage.addLayoutManager(layoutManager)
    layoutManager.addTextContainer(textContainer)

    // フォント設定
    let font = UIFont.systemFont(ofSize: fontSize)
    textStorage.addAttribute(.font, value: font, range: NSRange(location: 0, length: text.utf16.count))

    // 行の高さを設定
    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.minimumLineHeight = lineHeight
    paragraphStyle.maximumLineHeight = lineHeight
    textStorage.addAttribute(.paragraphStyle, value: paragraphStyle, range: NSRange(location: 0, length: text.utf16.count))

    // レイアウトを強制的に実行
    layoutManager.ensureLayout(for: textContainer)

    // タップ位置から文字インデックスを取得
    let point = CGPoint(x: max(0, x), y: max(0, y))
    let index = layoutManager.characterIndex(
      for: point,
      in: textContainer,
      fractionOfDistanceBetweenInsertionPoints: nil
    )

    return index
  }
}
