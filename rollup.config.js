import json from "@rollup/plugin-json"
import resolve from "@rollup/plugin-node-resolve"
import external from "rollup-plugin-peer-deps-external"
import html from "@open-wc/rollup-plugin-html"
import { terser } from "rollup-plugin-terser"
import babel from "@rollup/plugin-babel"
import typescript from "rollup-plugin-typescript2"
import pkg from "./package.json"

export default [
  {
    input: "src/index.ts",
    plugins: [
      external(),
      resolve(),
      json({ exclude: ["node_modules/**", "examples/**"] }),
      // terser(),
      babel({ babelHelpers: "bundled" }),
      typescript({
        rollupCommonJSResolveHack: true,
        clean: true,
        tsconfig: "./tsconfig.json"
      }),
      terser()
    ],
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    output: [
      {
        file: pkg.main,
        format: "cjs",
        exports: "named",
        sourcemap: true
      },
      {
        file: pkg.module,
        format: "es",
        exports: "named",
        sourcemap: true
      }
    ]
  },
  {
    input: "examples/three.html",
    output: { dir: "dist" },
    plugins: [typescript(), html(), resolve()]
  },
  {
    input: "examples/custominput.html",
    output: { dir: "dist" },
    plugins: [typescript(), html(), resolve()]
  },
  {
    input: "examples/index.html",
    output: { dir: "dist" },
    plugins: [typescript(), html(), resolve()]
  }
]
