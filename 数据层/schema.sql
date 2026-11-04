-- 中文套式 · 关系库
--
-- 一棵树放代码，一棵树放场景，中间靠一条「实例化」边连起来。
-- 所有身份都是点分路径，跟文件夹一样：
--
--   场景   SampleScene
--   物体   SampleScene.Canvas.Slider
--   组件   SampleScene.Canvas.Slider.HpBar
--   脚本   HpBar
--   方法   HpBar.Update
--   字段   HpBar.playerData
--
-- 主键前面带树标记（场景| / 代码|），因为场景名和类名可能重名 ——
-- 有个场景叫 Enemy、同时有个类叫 Enemy，一点都不奇怪。
-- 这个前缀只在库里用，显示时切掉。

PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS 节点 (
    id    TEXT PRIMARY KEY,
    树    TEXT NOT NULL,          -- 场景 | 代码
    类型  TEXT NOT NULL,          -- 场景 | 物体 | 组件 | 脚本 | 方法 | 字段
    名字  TEXT NOT NULL,          -- 路径末段，用来搜索
    父    TEXT,                   -- 上级 id，构成树
    文件  TEXT,                   -- 出自哪个源文件
    附加  TEXT                    -- JSON 载荷（tag、字段类型、行号……）
);

CREATE INDEX IF NOT EXISTS ix_节点_树类型 ON 节点(树, 类型);
CREATE INDEX IF NOT EXISTS ix_节点_名字   ON 节点(名字);
CREATE INDEX IF NOT EXISTS ix_节点_父     ON 节点(父);

CREATE TABLE IF NOT EXISTS 边 (
    自    TEXT NOT NULL,
    到    TEXT NOT NULL,
    种类  TEXT NOT NULL,          -- 实例化 | 引用 | 取组件 | 查找 | 调用
    来源  TEXT NOT NULL,          -- 扫描 | 人工
    行    INTEGER,
    原文  TEXT,
    附加  TEXT,
    PRIMARY KEY (自, 到, 种类, 来源)
);

CREATE INDEX IF NOT EXISTS ix_边_自   ON 边(自);
CREATE INDEX IF NOT EXISTS ix_边_到   ON 边(到);
CREATE INDEX IF NOT EXISTS ix_边_种类 ON 边(种类);

-- 图的摆位：是你说的地方就存这儿，重新扫描不会冲掉
CREATE TABLE IF NOT EXISTS 布局 (
    id   TEXT PRIMARY KEY,
    x    REAL NOT NULL,
    y    REAL NOT NULL,
    宽   REAL,
    高   REAL,
    收起 INTEGER NOT NULL DEFAULT 0
);

-- 断口的申诉：扫描说「这里少个接应」，你说不是 —— 记在这儿。
-- 重灌数据不会动这张表，跟布局一样，是你的话不是扫出来的话。
--
-- 三种动作：
--   连到  你说它其实指向谁 → 出图时改成一条正常的线
--   正常  目标真没有，但这是误报 → 框留着，不标红
--   隐藏  这是误报，而且不想看见 → 不出这个框
CREATE TABLE IF NOT EXISTS 申诉 (
    id    TEXT PRIMARY KEY,       -- 断口的身份（自|字段|种类）
    动作  TEXT NOT NULL,          -- 连到 | 正常 | 隐藏
    目标  TEXT,                   -- 连到时，指向谁
    时间  TEXT
);

-- 大注释框：你按住右键在画布上拖出来的那个框。
--
-- 是「整理」，不是「分类」—— 所以它不代表任何结构关系，只是一块地方。
--
-- ⚠️ 2026-11-04 改了：**框套框改成真父子**。
--    原来靠「小框的中心落在大框里」现算成员，看着很省事（不建表、天然嵌套、
--    拖动不用递归），实际丢掉了 DOM 白送的两样东西：
--      ① 子元素画在父元素上面（浏览器保证）—— 现算的话「谁在上面」没有答案；
--      ② 事件冒泡天然分层 —— 现算的话父框一开 pointer-events，整块矩形全被它占住。
--    结果就是「框里套的框点不中、拖不动」，Unreal 十年没修好的 UE-9417 是同一个病。
--    现在 父 存上级框的 id（空 = 顶层）；子框的 x/y 是**相对父框**的，
--    跟代码块的「块在容器里」是同一套坐标规矩。
--
-- ⚠️ 跟 Unreal 那套的关键差别：**框不自动跟随内容伸缩**。
--    Unreal 里框不会自己长大，一堆人天天手动拖边框；AutosizeComments 那个插件
--    让它自动调，结果又跟缩放打架（节点尺寸随缩放变，算不准，Reactive 模式会把
--    当时的缩放级别「快照」进去）。这里干脆不调：框是你画多大就多大。
CREATE TABLE IF NOT EXISTS 注释框 (
    id    TEXT PRIMARY KEY,
    标题  TEXT,
    x     REAL NOT NULL,
    y     REAL NOT NULL,
    宽    REAL NOT NULL,
    高    REAL NOT NULL,
    色    TEXT,
    收起  INTEGER NOT NULL DEFAULT 0,
    父    TEXT
);

-- 这份库是谁、什么时候扫的
CREATE TABLE IF NOT EXISTS 元信息 (
    键 TEXT PRIMARY KEY,
    值 TEXT
);
