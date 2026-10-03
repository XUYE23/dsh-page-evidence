# DSH Page Evidence

为 DSH 提供逐页 PDF 证据：明确提示漏读页、按需调用本地 CPU OCR、保留引用页码与原文偏移。

**当前为本地实验性 alpha。** 已验证 Windows / Node 24、中英文 CPU OCR，以及 DSH `0.2.0-rc.2` 的真实工具运行时。完整 Web 安装流程、真实用户文档集与跨平台运行仍待验收。

[在线演示](https://xuye23.github.io/dsh-page-evidence/) · [下载安装包](https://github.com/XUYE23/dsh-page-evidence/releases/tag/v0.1.0-alpha.1) · [English](README.md) · [需求与竞品证据](docs/research.md) · [验证记录](docs/validation.md)

## 已复现的问题

在 `dsh-docintel@7574023` 中导入三页混合 PDF：第 2 页为扫描图，内容被漏掉且没有告警；查询第 3 页的关键词，返回的页码为 1。原因分别是按整份文档平均字符数判定扫描件，以及跨页合并文本块后只保留首段页码。

验证版提供逐页检查、可选 OCR，以及每页独立的引用和分块。仓库包含复现用 PDF 与前后对比脚本。此结论限定于对应版本和最小样例。

## 本地体验

需要 Node 24。在本目录运行：

```sh
git clone https://github.com/XUYE23/dsh-page-evidence.git
cd dsh-page-evidence
npm ci --ignore-scripts
npm run demo
node src/cli.mjs test/fixtures/mixed-pages.pdf --ocr --query NEBULA
node src/cli.mjs test/fixtures/chinese-scan.pdf --ocr --language chi_sim --query 现金流
```

打开 `outputs/demo.html`，可切换文字层提取和本地 OCR，查看逐页结果；JSON 原始数据位于同目录。

安装依赖时需要网络。文档处理阶段使用本地语言包，不调用外部模型服务。中文查询支持 OCR 在汉字间插入空格的情况，引用仍保留识别原文及偏移。

## 接入 DSH

从 [GitHub Release](https://github.com/XUYE23/dsh-page-evidence/releases/tag/v0.1.0-alpha.1) 下载 `.tgz` 安装包，然后运行：

```sh
dsh plugin --profile web add ./dsh-page-evidence-0.1.0-alpha.1.tgz
```

重启后，工具名称为 `pdf_page_evidence`。通过 DSH 插件配置将 `workspaceRoot` 设为允许读取的文档目录；默认取宿主启动目录。首版通过本机文件系统读取，远程 SSH／容器文件系统适配尚未实现。

工具参数示例：

```json
{"path":"资料.pdf","pages":[2,3],"ocr":true,"language":"eng+chi_sim","query":"现金流"}
```

结果包含文件 SHA-256、物理页码、读取方式、原文、引用偏移和覆盖告警。文字层较少的页面可触发 OCR。搜索采用字面关键词匹配，多个词须出现在同一页。

## 适用边界

- 单次最多 20 页、文件最大 32 MiB、OCR 渲染最大 1200 万像素；默认超时 120 秒，每页最多返回 8000 个 UTF-16 单元，并标记截断。
- 低文本阈值为每页 30 个非空白字符，短页与空白页也可能被标记；文字较多的页面中的图片区域暂不纳入检测。
- OCR 分数用于提示复核优先级；来源哈希用于确定文件版本。字符准确性与引用含义需要结合原页核验。
- 页码为 PDF 物理页序号；文内印刷页码可能不同。复杂表格、公式、手写、多栏顺序需要单独评测。
- 两份合成样例用于功能回归，不能代表真实文档的总体准确率。
- DSH 工具结果会进入用户配置的模型上下文。文档中的文字应作为待核验的外部资料处理。

原始项目与方案比较、可复现测试及后续验收标准见链接文档。MIT 许可证。
