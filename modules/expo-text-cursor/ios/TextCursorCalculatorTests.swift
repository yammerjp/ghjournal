import XCTest

class TextCursorCalculatorTests: XCTestCase {

  let fontSize: CGFloat = 16.0
  let containerWidth: CGFloat = 300.0

  // MARK: - 基本テスト

  func testEmptyText_ReturnsZero() {
    let index = TextCursorCalculator.getCharacterIndex(
      text: "",
      x: 100,
      y: 10,
      fontSize: fontSize,
      containerWidth: containerWidth
    )
    XCTAssertEqual(index, 0)
  }

  func testTapAtStart_ReturnsZeroOrNearZero() {
    let text = "Hello, World!"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: 0,
      fontSize: fontSize,
      containerWidth: containerWidth
    )
    // テキストの先頭付近をタップした場合、0に近いインデックスが返る
    XCTAssertLessThanOrEqual(index, 1)
  }

  func testTapAtEnd_ReturnsNearEndIndex() {
    let text = "Hello"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: containerWidth - 10,
      y: 0,
      fontSize: fontSize,
      containerWidth: containerWidth
    )
    // テキストの末尾付近をタップした場合、末尾に近いインデックスが返る
    // 短いテキストなので、文字数以下であることを確認
    XCTAssertLessThanOrEqual(index, text.count)
  }

  // MARK: - 複数行テスト

  func testMultilineText_SecondLine() {
    let text = "First line\nSecond line"
    let lineHeight: CGFloat = 20.0 // 大体の行の高さ

    // 2行目をタップ
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: lineHeight + 5,
      fontSize: fontSize,
      containerWidth: containerWidth
    )
    // 2行目の開始位置（"First line\n"の長さ = 11）付近
    XCTAssertGreaterThanOrEqual(index, 10)
  }

  // MARK: - 日本語テスト

  func testJapaneseText_TapInMiddle() {
    let text = "こんにちは世界"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 50, // 中間あたり
      y: 5,
      fontSize: fontSize,
      containerWidth: containerWidth
    )
    // 何らかの有効なインデックスが返る
    XCTAssertGreaterThanOrEqual(index, 0)
    XCTAssertLessThanOrEqual(index, text.count)
  }

  // MARK: - 境界テスト

  func testNegativeCoordinates_ReturnsValidIndex() {
    let text = "Hello"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: -10,
      y: -10,
      fontSize: fontSize,
      containerWidth: containerWidth
    )
    // 負の座標でも有効なインデックスが返る（先頭に補正される）
    XCTAssertGreaterThanOrEqual(index, 0)
  }

  func testVeryLargeY_ReturnsLastLineIndex() {
    let text = "Line1\nLine2\nLine3"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: 1000, // 非常に大きいY座標
      fontSize: fontSize,
      containerWidth: containerWidth
    )
    // 最後の行のインデックスが返る
    XCTAssertGreaterThanOrEqual(index, 12) // "Line1\nLine2\n" = 12文字
  }
}
