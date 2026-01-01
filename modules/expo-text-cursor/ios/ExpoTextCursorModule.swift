import ExpoModulesCore

public class ExpoTextCursorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoTextCursor")

    Function("getCharacterIndex") { (text: String, x: Double, y: Double, fontSize: Double, lineHeight: Double, containerWidth: Double) -> Int in
      return TextCursorCalculator.getCharacterIndex(
        text: text,
        x: CGFloat(x),
        y: CGFloat(y),
        fontSize: CGFloat(fontSize),
        lineHeight: CGFloat(lineHeight),
        containerWidth: CGFloat(containerWidth)
      )
    }
  }
}
