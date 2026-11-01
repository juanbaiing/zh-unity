(function () {

// ============================================================
// Unity API 中英词表
// 格式：中文（english）—— 记不住时看括号，编辑器里写哪个都行
// ============================================================

// ---- 类型 ----
const 类型词表 = {
  '整数': 'int',
  '小数': 'float',
  '文本': 'string',
  '布尔': 'bool',
  '向量': 'Vector3',
  '物体': 'GameObject',
  '组件': 'Component',
  '刚体': 'Rigidbody',
  '碰撞': 'Collider',
  '颜色': 'Color',
  '变换': 'Transform',
  '精灵': 'SpriteRenderer',
  // 列表单独给类型：数组 int[] 没有 Add，要增删必须用 List
  '整数列表': 'List<int>',
  '小数列表': 'List<float>',
  '文本列表': 'List<string>',
  '物体列表': 'List<GameObject>',
  '变换列表': 'List<Transform>',
};

// ---- 成员（带点访问：目标.位置 → 目标.position）----
const 成员词表 = {
  // Transform 变换
  '位置': 'position',
  '本地位置': 'localPosition',
  '旋转': 'rotation',
  '本地旋转': 'localRotation',
  '缩放': 'localScale',
  '本地欧拉': 'localEulerAngles',
  '父物体': 'parent',
  '子物体数': 'childCount',
  '向前': 'forward',
  '向上': 'up',
  '向右': 'right',

  // GameObject 物体
  '名字': 'name',
  '激活': 'activeSelf',
  '标签': 'tag',

  // Rigidbody 刚体
  '速度': 'velocity',
  '质量': 'mass',
  '角速度': 'angularVelocity',
  '重力': 'useGravity',

  // Color / Sprite
  '颜色': 'color',
  '透明度': 'a',
  '红': 'r',
  '绿': 'g',
  '蓝': 'b',
};

// ---- 独立函数 / 静态成员 ----
const 函数词表 = {
  '销毁': 'Destroy',
  '实例化': 'Instantiate',
  '设置激活': 'SetActive',
  '获得组件': 'GetComponent',
  '添加组件': 'AddComponent',
  '找物体': 'Find',
  '加力': 'AddForce',
  '打印': 'Debug.Log',
  '警告': 'Debug.LogWarning',
  '报错': 'Debug.LogError',
  '时间': 'Time.time',
  '帧间隔': 'Time.deltaTime',
  '固定帧间隔': 'Time.fixedDeltaTime',
  '水平轴': 'Input.GetAxis',
  '按下键': 'Input.GetKeyDown',
  '按住键': 'Input.GetKey',
  '抬起键': 'Input.GetKeyUp',
  '零向量': 'Vector3.zero',
  '一向量': 'Vector3.one',
};

// ---- Unity 固定方法名（引擎按名字调用，不能改）----
const 生命周期词表 = {
  '开始时': 'Start',
  '更新时': 'Update',
  '物理更新时': 'FixedUpdate',
  '晚更新时': 'LateUpdate',
  '销毁时': 'OnDestroy',
  '启用时': 'OnEnable',
  '禁用时': 'OnDisable',
  '碰撞进入时': 'OnCollisionEnter',
  '碰撞离开时': 'OnCollisionExit',
  '触发进入时': 'OnTriggerEnter',
  '触发离开时': 'OnTriggerExit',
  '鼠标按下时': 'OnMouseDown',
};

// 统一导出：浏览器挂 window，Node 走 require
const UnityWords = { 类型词表, 成员词表, 函数词表, 生命周期词表 };

if (typeof window !== 'undefined') window.UnityWords = UnityWords;
if (typeof module !== 'undefined') module.exports = UnityWords;

})();
