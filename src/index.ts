/*
 * @Description: auto-translation
 * @Author: Sunly
 * @Date: 2023-08-09 05:21:35
 */
import tencentcloud from "tencentcloud-sdk-nodejs";
import fs from "fs";
import path from "path";
import type { IOptions, ILangJson, ILangObj, ILang } from "./index.d";
import { createUnplugin } from "unplugin";

const DEFAULT_SPACE = 2;

const setSymbol = (s: string) => Symbol(s);
const getSymbol = (s: symbol) => s.toString().slice(7, -1);

// 获取完整路径
function getFullPath(targetDirPath: string, filename: string) {
  return path.resolve(targetDirPath, `${filename}.json`);
}

// 读取文件转换为对象
function fileToObj(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const text = fs.readFileSync(filePath, { encoding: "utf-8" });
  return text ? JSON.parse(text) : {};
}

// 休眠
function sleep(time: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve(0);
    }, time);
  });
}

// 生成一个新的对象，标记所有需要翻译的文本
function getNeedTranslationObj(originObj: ILangJson, targetObj: ILangJson) {
  const diffTwoObj = (originObj: ILangJson, targetObj: ILangJson) => {
    const needTranslationObj = {} as ILangObj;
    for (const key in originObj) {
      if (!(key in targetObj)) {
        const item = originObj[key];
        if (typeof item === "string") {
          needTranslationObj[key] = setSymbol(item);
        } else {
          needTranslationObj[key] = deepTraversal(item, (text) =>
            typeof text === "string" ? setSymbol(text) : text
          );
        }
      } else {
        const item = originObj[key];
        const targetItem = targetObj[key];
        if (typeof item === "string" && typeof targetItem === "string") {
          needTranslationObj[key] = targetItem;
        } else if (typeof item === "object" && typeof targetItem === "object") {
          needTranslationObj[key] = diffTwoObj(item, targetItem);
        } else if (typeof item === "object" && typeof targetItem === "string") {
          needTranslationObj[key] = deepTraversal(item, (text) =>
            typeof text === "string" ? setSymbol(text) : text
          );
        } else if (typeof item === "string" && typeof targetItem === "object") {
          needTranslationObj[key] = setSymbol(item);
        }
      }
    }
    return needTranslationObj;
  };

  return diffTwoObj(originObj, targetObj);
}

// 遍历新的对象，将所有要翻译的文本提取出来
// 因为getNeedTranslation中修改了obj，所以遍历要单独进行，保证顺序
function getNeedTranslationText(obj: ILangObj): string {
  const arr: string[] = [];
  deepTraversal(obj, (val) => {
    if (typeof val === "symbol") {
      arr.push(getSymbol(val));
    }
    return val;
  });
  return arr.join("\n");
}

// 深度遍历并处理一个对象
function deepTraversal<T extends symbol | string>(
  obj: ILangObj,
  cb: (val: T) => T
): ILangObj {
  const stack = [] as ILangObj[];
  stack.push(obj);
  while (stack.length) {
    const cur = stack.pop();
    for (const key in cur) {
      const item = cur[key];
      if (typeof item === "object") {
        stack.push(item);
      } else {
        cur[key] = cb(item as T);
      }
    }
  }
  return obj;
}

async function translationText(
  id: string,
  key: string,
  originLang: string,
  targetLang: string,
  needTranslationText: string
): Promise<string> {
  const TmtClient = tencentcloud.tmt.v20180321.Client;
  const clientConfig = {
    credential: {
      secretId: id,
      secretKey: key,
    },
    region: "ap-beijing",
    profile: {
      signMethod: "TC3-HMAC-SHA256", // 签名方法
      reqMethod: "POST", // 请求方法
      // httpProfile: {
      //   endpoint: "tmt.tencentcloudapi.com"
      // }
    },
  } as const;

  const client = new TmtClient(clientConfig);
  const params = {
    SourceText: needTranslationText,
    Source: originLang,
    Target: targetLang,
    ProjectId: 0,
  } as const;
  try {
    const data = await client.TextTranslate(params);
    console.log(`\n翻译 ${targetLang} 成功`);
    return data.TargetText || "";
  } catch (error) {
    console.log(error);
    throw new Error("请求发生错误");
  }
}

// 将翻译的文本写入对应的文件
function writeFile(
  targetDirPath: string,
  targetObj: ILangObj,
  transText: string,
  filename: string,
  spaceWidth: number
) {
  const translatedArr = transText.split("\n");

  deepTraversal(targetObj, (val) => {
    if (typeof val === "symbol") {
      return translatedArr.shift() || "";
    }
    return val;
  });

  const filePath = getFullPath(targetDirPath, filename);
  fs.writeFileSync(filePath, JSON.stringify(targetObj, null, spaceWidth), {
    encoding: "utf-8",
  });

  console.log(`生成翻译文件 ${filename}.json 成功`);
}

const UnpluginAutoTranslation = createUnplugin((options: IOptions) => {
  return {
    name: "unplugin-auto-translation",
    async buildStart() {
      const id: string = options.id; // api id
      const key: string = options.key; // api key
      const originLang: string = options.originLang; // 原始语言名称
      const targetLangs: ILang[] = options.targetLangs; // 翻译后语言名称和文件名
      const originFilePath: string = options.originFilePath; // 原始语言文件路径
      const targetDirPath: string = options.targetDirPath; // 翻译后生成的语言文件存放路径
      let originObj: ILangJson = {}; // 原始语言对象
      let targetObj: ILangObj = {}; // 翻译后语言对象
      const spaceWidth: number = options.spaceWidth || DEFAULT_SPACE; // 翻译后文件缩进宽度

      // 读取原始文件
      originObj = fileToObj(originFilePath);

      // 遍历langs数组，生成翻译文件
      for (const {
        filename: targetFilename,
        lang: targetLang,
      } of targetLangs) {
        console.log("\n准备翻译", targetLang);

        // 初始化
        targetObj = {};

        try {
          // 读取目标文件，文件不存在则创建一个空对象
          targetObj = fileToObj(getFullPath(targetDirPath, targetFilename));
          // 生成一个对象，标记所有需要翻译的文本
          targetObj = getNeedTranslationObj(originObj, targetObj as ILangJson);
          // 遍历新的对象，将所有要翻译的文本提取出来
          const needTranslation = getNeedTranslationText(targetObj);

          if (!needTranslation) {
            console.log(`${targetLang}没有新增内容，无需翻译`);
            continue;
          }

          // 翻译文本
          const data = await translationText(
            id,
            key,
            originLang,
            targetLang,
            needTranslation
          );

          if (data === "") {
            if (needTranslation) {
              console.log(`${targetLang}翻译失败`);
            }
            continue;
          }

          // 写入文件
          writeFile(targetDirPath, targetObj, data, targetFilename, spaceWidth);
          await sleep(6000);
        } catch (e) {
          console.error(e);
        }
      }
    },
  };
});

export { UnpluginAutoTranslation };
