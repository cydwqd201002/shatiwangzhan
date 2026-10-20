# 题库转换报告

生成时间：Fri Oct 16 11:21:02 2026 UTC

## 题量核对

| 题库 | 解析题数 | 可判分 | 章节 | 题型分布 |
|---|---|---|---|---|
| Java程序设计题库 | 219 | 218 | 1 | judge 15 + multiple 12 + single 192 |
| Web前端题库 | 120 | 118 | 6 | judge 42 + multiple 13 + single 65 |

## 数据异常清单

| 级别 | 题库 | 题目 | 类型 | 说明 |
|---|---|---|---|---|
| 错误 | java | java-71 | `missing-answer` | 第 71 题原始题库缺失答案，无法判分（保留原题，标记为不计分） |
| 提示 | java | java-142 | `no-explanation` | 第 142 题没有解析 |
| 错误 | web | web-31 | `no-options` | 第 31 题没有解析出任何选项 |
| 错误 | web | web-31 | `answer-not-in-options` | 第 31 题答案「A」不在选项（）里，按原样保留但不计入得分 |
| 错误 | web | web-80 | `answer-not-in-options` | 第 80 题答案「E」不在选项（ABCD）里，按原样保留但不计入得分 |
| 提示 | web | web-118 | `duplicate-stem` | 第 118 题题干与第 102 题重复 |

> 说明：题目内容一律按原始 Markdown 原样保留，本脚本不做任何修正。
> 影响判分的异常题会在前端标记为「不计分」，但依然可以查看和作答。
