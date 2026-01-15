const {
  withInfoPlist,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// 日本語のInfoPlist.strings内容
const jaStrings = `/* Location permission descriptions */
"NSLocationWhenInUseUsageDescription" = "日記に現在地を記録し、その場所の天気情報を取得するために位置情報を使用します。位置情報は日記のメタデータとして保存されます。";
"NSLocationAlwaysUsageDescription" = "日記に現在地を記録し、その場所の天気情報を取得するために位置情報を使用します。位置情報は日記のメタデータとして保存されます。";
"NSLocationAlwaysAndWhenInUseUsageDescription" = "日記に現在地を記録し、その場所の天気情報を取得するために位置情報を使用します。位置情報は日記のメタデータとして保存されます。";

/* Face ID permission description */
"NSFaceIDUsageDescription" = "Face IDを使用してアプリのセキュリティを保護します。";
`;

// 英語のInfoPlist.strings内容（デフォルト）
const enStrings = `/* Location permission descriptions */
"NSLocationWhenInUseUsageDescription" = "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.";
"NSLocationAlwaysUsageDescription" = "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.";
"NSLocationAlwaysAndWhenInUseUsageDescription" = "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.";

/* Face ID permission description */
"NSFaceIDUsageDescription" = "Face ID is used to protect the security of your app.";
`;

function generateUUID() {
  return "XXXXXXXXXXXXXXXXXXXXXXXX".replace(/X/g, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  );
}

function withInfoPlistLocalization(config) {
  // Info.plistのデフォルト値を更新
  config = withInfoPlist(config, (config) => {
    config.modResults.NSLocationWhenInUseUsageDescription =
      "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.";
    config.modResults.NSLocationAlwaysUsageDescription =
      "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.";
    config.modResults.NSLocationAlwaysAndWhenInUseUsageDescription =
      "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.";
    config.modResults.NSFaceIDUsageDescription =
      "Face ID is used to protect the security of your app.";
    return config;
  });

  // ローカライズファイルを作成し、project.pbxprojを直接編集
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName;
      const iosPath = path.join(projectRoot, "ios", projectName);
      const pbxprojPath = path.join(
        projectRoot,
        "ios",
        `${projectName}.xcodeproj`,
        "project.pbxproj"
      );

      // ja.lprojフォルダを作成
      const jaLprojPath = path.join(iosPath, "ja.lproj");
      if (!fs.existsSync(jaLprojPath)) {
        fs.mkdirSync(jaLprojPath, { recursive: true });
      }

      // en.lprojフォルダを作成
      const enLprojPath = path.join(iosPath, "en.lproj");
      if (!fs.existsSync(enLprojPath)) {
        fs.mkdirSync(enLprojPath, { recursive: true });
      }

      // InfoPlist.stringsファイルを作成
      fs.writeFileSync(path.join(jaLprojPath, "InfoPlist.strings"), jaStrings);
      fs.writeFileSync(path.join(enLprojPath, "InfoPlist.strings"), enStrings);

      // project.pbxprojを読み込み
      let pbxproj = fs.readFileSync(pbxprojPath, "utf8");

      // 既にInfoPlist.stringsが追加されている場合はスキップ
      if (pbxproj.includes("InfoPlist.strings")) {
        return config;
      }

      // UUIDを生成
      const variantGroupUuid = generateUUID();
      const enFileUuid = generateUUID();
      const jaFileUuid = generateUUID();
      const buildFileUuid = generateUUID();

      // PBXFileReference セクションに追加
      const fileRefSection = `/* Begin PBXFileReference section */`;
      const fileRefAdditions = `
		${enFileUuid} /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = ${projectName}/en.lproj/InfoPlist.strings; sourceTree = "<group>"; };
		${jaFileUuid} /* ja */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ja; path = ${projectName}/ja.lproj/InfoPlist.strings; sourceTree = "<group>"; };`;

      pbxproj = pbxproj.replace(
        fileRefSection,
        fileRefSection + fileRefAdditions
      );

      // PBXVariantGroup セクションを追加（存在しない場合）
      if (!pbxproj.includes("/* Begin PBXVariantGroup section */")) {
        // PBXResourcesBuildPhase セクションの前に追加
        const resourcesSection = `/* Begin PBXResourcesBuildPhase section */`;
        const variantGroupSection = `/* Begin PBXVariantGroup section */
		${variantGroupUuid} /* InfoPlist.strings */ = {
			isa = PBXVariantGroup;
			children = (
				${enFileUuid} /* en */,
				${jaFileUuid} /* ja */,
			);
			name = InfoPlist.strings;
			sourceTree = "<group>";
		};
/* End PBXVariantGroup section */

`;
        pbxproj = pbxproj.replace(resourcesSection, variantGroupSection + resourcesSection);
      } else {
        // 既存のPBXVariantGroup セクションに追加
        const variantGroupEnd = `/* End PBXVariantGroup section */`;
        const variantGroupAddition = `		${variantGroupUuid} /* InfoPlist.strings */ = {
			isa = PBXVariantGroup;
			children = (
				${enFileUuid} /* en */,
				${jaFileUuid} /* ja */,
			);
			name = InfoPlist.strings;
			sourceTree = "<group>";
		};
`;
        pbxproj = pbxproj.replace(variantGroupEnd, variantGroupAddition + variantGroupEnd);
      }

      // PBXBuildFile セクションに追加
      const buildFileSection = `/* Begin PBXBuildFile section */`;
      const buildFileAddition = `
		${buildFileUuid} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${variantGroupUuid} /* InfoPlist.strings */; };`;
      pbxproj = pbxproj.replace(buildFileSection, buildFileSection + buildFileAddition);

      // PBXGroup（プロジェクト名のグループ）にVariant Groupを追加
      // ghjournal グループを探して追加
      const groupPattern = new RegExp(
        `(\\s+\\/\\* ${projectName} \\*\\/ = \\{[^}]+children = \\([^)]+)(\\);)`,
        "s"
      );
      pbxproj = pbxproj.replace(
        groupPattern,
        `$1\n\t\t\t\t${variantGroupUuid} /* InfoPlist.strings */,\n\t\t\t$2`
      );

      // PBXResourcesBuildPhase に追加
      const resourcesPattern = /(isa = PBXResourcesBuildPhase;[^}]+files = \([^)]+)/s;
      pbxproj = pbxproj.replace(
        resourcesPattern,
        `$1\n\t\t\t\t${buildFileUuid} /* InfoPlist.strings in Resources */,`
      );

      // knownRegions に ja を追加
      const knownRegionsPattern = /(knownRegions = \()([^)]+)(\);)/;
      const match = pbxproj.match(knownRegionsPattern);
      if (match) {
        let regions = match[2];
        if (!regions.includes("ja")) {
          regions = regions.trim();
          if (!regions.endsWith(",")) {
            regions += ",";
          }
          regions += "\n\t\t\t\tja,\n\t\t\t";
        }
        pbxproj = pbxproj.replace(knownRegionsPattern, `$1${regions}$3`);
      }

      // ファイルを保存
      fs.writeFileSync(pbxprojPath, pbxproj);

      return config;
    },
  ]);

  return config;
}

module.exports = withInfoPlistLocalization;
