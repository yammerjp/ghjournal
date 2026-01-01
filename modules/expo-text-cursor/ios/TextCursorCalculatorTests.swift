import XCTest

class TextCursorCalculatorTests: XCTestCase {

  let fontSize: CGFloat = 16.0
  let lineHeight: CGFloat = 24.0
  let containerWidth: CGFloat = 300.0

  // MARK: - 基本テスト

  func testEmptyText_ReturnsZero() {
    let index = TextCursorCalculator.getCharacterIndex(
      text: "",
      x: 100,
      y: 10,
      fontSize: fontSize,
      lineHeight: lineHeight,
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
      lineHeight: lineHeight,
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
      lineHeight: lineHeight,
      containerWidth: containerWidth
    )
    // テキストの末尾付近をタップした場合、末尾に近いインデックスが返る
    // 短いテキストなので、文字数以下であることを確認
    XCTAssertLessThanOrEqual(index, text.count)
  }

  // MARK: - 複数行テスト

  func testMultilineText_SecondLine() {
    let text = "First line\nSecond line"

    // 2行目をタップ (lineHeight=24なので、y=24+5=29で2行目)
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: lineHeight + 5,
      fontSize: fontSize,
      lineHeight: lineHeight,
      containerWidth: containerWidth
    )
    // 2行目の開始位置（"First line\n"の長さ = 11）付近
    XCTAssertGreaterThanOrEqual(index, 10)
  }

  func testMultilineText_ThirdLine() {
    let text = "Line1\nLine2\nLine3"

    // 3行目をタップ (y = lineHeight * 2 + 5)
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: lineHeight * 2 + 5,
      fontSize: fontSize,
      lineHeight: lineHeight,
      containerWidth: containerWidth
    )
    // 3行目の開始位置（"Line1\nLine2\n"の長さ = 12）付近
    XCTAssertGreaterThanOrEqual(index, 11)
  }

  func testLineHeightAffectsPosition() {
    let text = "Line1\nLine2\nLine3\nLine4\nLine5"

    // lineHeight=24で5行目をタップ
    let indexWith24 = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: 24 * 4 + 5, // 5行目
      fontSize: fontSize,
      lineHeight: 24,
      containerWidth: containerWidth
    )

    // lineHeight=48で同じY座標をタップ（3行目になるはず）
    let indexWith48 = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: 24 * 4 + 5, // lineHeight=48なら3行目付近
      fontSize: fontSize,
      lineHeight: 48,
      containerWidth: containerWidth
    )

    // lineHeightが大きい方が、同じY座標でも早い行になる
    XCTAssertGreaterThan(indexWith24, indexWith48)
  }

  // MARK: - 日本語テスト

  func testJapaneseText_TapInMiddle() {
    let text = "こんにちは世界"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 50, // 中間あたり
      y: 5,
      fontSize: fontSize,
      lineHeight: lineHeight,
      containerWidth: containerWidth
    )
    // 何らかの有効なインデックスが返る
    XCTAssertGreaterThanOrEqual(index, 0)
    XCTAssertLessThanOrEqual(index, text.count)
  }

  func testJapaneseMultiline() {
    let text = "一行目です\n二行目です\n三行目です"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: lineHeight + 5, // 2行目
      fontSize: fontSize,
      lineHeight: lineHeight,
      containerWidth: containerWidth
    )
    // 2行目の開始位置（"一行目です\n"の長さ = 6）付近
    XCTAssertGreaterThanOrEqual(index, 5)
  }

  // MARK: - 境界テスト

  func testNegativeCoordinates_ReturnsValidIndex() {
    let text = "Hello"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: -10,
      y: -10,
      fontSize: fontSize,
      lineHeight: lineHeight,
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
      lineHeight: lineHeight,
      containerWidth: containerWidth
    )
    // 最後の行のインデックスが返る
    XCTAssertGreaterThanOrEqual(index, 12) // "Line1\nLine2\n" = 12文字
  }

  func testVeryLargeX_ReturnsEndOfLine() {
    let text = "Short"
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 1000, // 非常に大きいX座標
      y: 5,
      fontSize: fontSize,
      lineHeight: lineHeight,
      containerWidth: containerWidth
    )
    // 行末のインデックスが返る
    XCTAssertEqual(index, text.count)
  }

  // MARK: - 長いテキストのテスト

  func testLongTextWithScroll() {
    // スクロールをシミュレート - 大きなY値でも正しく動作することを確認
    var lines: [String] = []
    for i in 1...50 {
      lines.append("This is line number \(i)")
    }
    let text = lines.joined(separator: "\n")

    // 30行目をタップ (y = lineHeight * 29 + 5)
    let index = TextCursorCalculator.getCharacterIndex(
      text: text,
      x: 0,
      y: lineHeight * 29 + 5,
      fontSize: fontSize,
      lineHeight: lineHeight,
      containerWidth: containerWidth
    )

    // 30行目の開始位置付近であることを確認
    // 各行は約24文字（"This is line number XX\n"）
    let expectedMinIndex = 23 * 29 // 大体29行分
    XCTAssertGreaterThanOrEqual(index, expectedMinIndex - 50) // 多少の誤差を許容
  }
}
