/*
 * @Description: 类型
 * @Author: Sunly
 * @Date: 2023-08-09 22:46:37
 */
declare type IOptions = {
  id: string;
  key: string;
  originLang: string;
  targetLangs: ILang[];
  originFilePath: string;
  targetDirPath: string;
  spaceWidth?: number;
};

declare type ILang = { lang: string; filename: string };

declare type ILangJson = {
  [key: string]: string | ILangJson;
};

declare type ILangObj = {
  [key: string]: string | symbol | ILangObj;
};

export { IOptions, ILangJson, ILangObj, ILang };
