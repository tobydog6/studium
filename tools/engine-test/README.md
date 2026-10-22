# Engine test: current renderer vs Spark 2

A one-file page that loads the same scan in the engine Studium uses today (GaussianSplats3D 0.4.7 on three 0.160)
and in Spark 2.3.1 (on three 0.180), with and without Spark's level of detail, and benchmarks each on the same orbit.

Build (from a scratch folder with `@sparkjsdev/spark@2.3.1 three@0.180.0 esbuild` installed):
- Spark bundle: `esbuild spark-entry.js --bundle --format=iife --minify --outfile=spark.bundle.js`
- Current bundle, against Studium's own three 0.160: run esbuild on `gs-entry.js` from a folder with no node_modules,
  with `NODE_PATH=<studium>/node_modules`.
- Put both bundles and base64 of `assets/scenes/stump-hd.stm` into `page.html` at `@@GS@@`, `@@SPARK@@`, `@@STM@@`.
