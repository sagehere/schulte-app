# 年龄等第评分依据

适用范围：斯特鲁普、记忆、译码训练的“优秀 / 良好 / 中等 / 需努力”仅为应用内训练参考，不是医学诊断或标准化心理测验常模。

## 共同规则

- 按成绩 `date` 当日的出生年龄评分；缺少出生日期不评分。
- 正确率 `<= 80%` 直接为“需努力”；其余按同龄阈值评分。该顺序参考 [NIH Toolbox Flanker/DCCS 评分说明](https://www.pediatricheartnetwork.org/wp-content/uploads/2020/11/Toolbox_Scoring_and_Interpretation_Guide_for_iPad_v1.7-5.25.21.pdf)。
- 年龄段：7–8、9–11、12–16、17–39、40–59、60+；7 岁以下的斯特鲁普和记忆、8 岁以下的译码显示暂无适龄标准。

## 阈值

数字依次是优秀、良好、中等边界；斯特鲁普和译码为总秒数（越低越好），记忆为最大无错误且未复现轮次（越高越好）。

| 年龄 | 斯特鲁普 | 记忆跨度 | 译码 |
| --- | --- | --- | --- |
| 7–8 | 24 / 28 / 32 | 6 / 5 / 4 | 仅 8 岁：53.3 / 64 / 77.8 |
| 9–11 | 21 / 24 / 27 | 7 / 6 / 5 | 43.8 / 52 / 60.8 |
| 12–16 | 20 / 23 / 26 | 8 / 7 / 6 | 31.8 / 36.5 / 44 |
| 17–39 | 17 / 19 / 22 | 8 / 7 / 6 | 31 / 33.4 / 38.3 |
| 40–59 | 18 / 21 / 24 | 7 / 6 / 5 | 32.8 / 36.4 / 42.5 |
| 60+ | 23 / 26 / 30 | 6 / 5 / 4 | 40.3 / 47.2 / 53.3 |

## 来源与限制

- 斯特鲁普参考 [儿童、青年和老年反应时研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC10062650/) 与 [全生命周期研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC11162033/)；按本项目 25 题规格换算并舍入。
- 记忆参考 [Corsi 儿童发展常模](https://pubmed.ncbi.nlm.nih.gov/16822742/) 与 [成人常模研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC11554723/)；`memorySpan` 是本项目最接近 Corsi 跨度的无辅助轮次，不与临床分数等同。
- 译码参考 [NIH Oral Symbol Digit 技术手册](https://www.healthmeasures.net/images/nihtoolbox/Technical_Manuals/Cognition/Toolbox_Oral_Symbol_Digit_Test_Technical_Manual.pdf) 的年龄四分位，换算为 24 题完成时间，并交叉参考 [儿童计算机译码研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC8101631/)。
- 文字答案 Stroop 和反向译码复用同龄训练参考；它们不是上述文献的同构标准任务。
