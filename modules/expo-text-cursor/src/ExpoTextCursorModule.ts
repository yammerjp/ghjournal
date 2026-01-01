import { NativeModule, requireNativeModule } from "expo-modules-core";

declare class ExpoTextCursorModuleType extends NativeModule {
  getCharacterIndex(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    lineHeight: number,
    containerWidth: number
  ): number;
}

export default requireNativeModule<ExpoTextCursorModuleType>("ExpoTextCursor");
