import ExpoTextCursorModule from "./ExpoTextCursorModule";

export function getCharacterIndex(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  lineHeight: number,
  containerWidth: number
): number {
  return ExpoTextCursorModule.getCharacterIndex(
    text,
    x,
    y,
    fontSize,
    lineHeight,
    containerWidth
  );
}
