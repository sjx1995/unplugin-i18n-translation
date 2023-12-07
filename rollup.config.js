/*
 * @Description: rollup config
 * @Author: Sunly
 * @Date: 2023-08-09 09:30:47
 */
import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import resolveJson from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";
import { dts } from "rollup-plugin-dts";

export default defineConfig([
  {
    input: "./src/index.ts",
    output: [
      {
        file: "./dist/index.cjs",
        format: "cjs",
      },
      {
        file: "./dist/index.mjs",
        format: "esm",
      },
    ],
    plugins: [
      commonjs(),
      resolveJson(),
      typescript({
        sourceMap: false,
      }),
      resolve(),
      terser(),
    ],
  },
  {
    input: "./src/index.d.ts",
    output: [
      {
        file: "./dist/index.d.ts",
        format: "es",
      },
    ],
    plugins: [dts()],
  },
]);
