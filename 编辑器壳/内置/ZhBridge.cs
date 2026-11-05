// 中文套式 <-> Unity 的桥梁。
// 只做一件事：把项目里「谁挂在哪、带什么值、引用指向谁」原样倒成一个 JSON。
// 不画界面 —— 界面在外部那个编辑器里。
//
// 菜单：工具 / 中文套式 / 导出关系数据

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ZhBridge
{
    internal static class 关系桥
    {
        // 放项目根下，不进 Assets，Unity 不会去 import 它
        private const string 桥目录名 = ".zh-bridge";
        private const string 数据文件名 = "关系.json";

        // 给「Unity 刚打开时要不要导一次」用的判据
        internal static string? 数据文件路径()
        {
            var 根 = 项目根();
            return 根 == null ? null : Path.Combine(根, 桥目录名, 数据文件名);
        }

        // ══════════════════════════════════════════════
        //  入口
        // ══════════════════════════════════════════════

        [MenuItem("工具/中文套式/导出关系数据 %#e", false, 1)]
        public static void 导出关系数据() => 跑一遍(false);

        // 自动导出走这个：不弹资源管理器、不动窗口。
        // 每保存一次场景就把文件夹弹出来，谁受得了。
        internal static void 导出关系数据_安静() => 跑一遍(true);

        private static void 跑一遍(bool 安静)
        {
            var 起 = DateTime.Now;
            var 根 = 项目根();
            if (根 == null)
            {
                EditorUtility.DisplayDialog("中文套式", "找不到项目根目录（Assets 的上一级）。", "知道了");
                return;
            }

            // 扫场景要先把当前场景的改动落下来，否则 additive 打开时可能提示
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            {
                Debug.Log("[中文套式] 用户取消了（场景有未保存的改动），这次不导。");
                return;
            }

            var 目录 = Path.Combine(根, 桥目录名);
            Directory.CreateDirectory(目录);

            List<脚本信息> 脚本;
            List<实例信息> 实例;
            var 场景数 = 0;
            try
            {
                脚本 = 收脚本();
                // 只认用户自己的脚本 —— 引擎自带的 CanvasScaler / Image / Text 全是噪音，
                // 一张图里堆满 m_Color / m_RaycastTarget 就什么都看不见了。
                var 白名单 = new Dictionary<string, 脚本信息>(StringComparer.Ordinal);
                foreach (var 信 in 脚本)
                    if (!白名单.ContainsKey(信.名)) 白名单[信.名] = 信;

                实例 = 收预制体(白名单);
                场景数 = 收场景(实例, 白名单);
            }
            catch (Exception 错)
            {
                // 不静默 —— 报错必须让人看见
                Debug.LogError("[中文套式] 导出失败：" + 错);
                EditorUtility.DisplayDialog("中文套式", "导出失败，看 Console 里的报错。\n" + 错.Message, "知道了");
                return;
            }

            var 文 = 拼JSON(根, 脚本, 实例);
            var 文件 = Path.Combine(目录, 数据文件名);
            File.WriteAllText(文件, 文, new UTF8Encoding(false)); // 无 BOM，外部好读

            var 用 = DateTime.Now - 起;
            var 字节 = new FileInfo(文件).Length;
            Debug.Log($"[中文套式] 导出完成：{脚本.Count} 个脚本 / {实例.Count} 个物体（预制体 + {场景数} 个场景），用时 {用.TotalMilliseconds:0} ms，{字节} 字节 → {文件}");

            if (!安静) EditorUtility.RevealInFinder(文件);
        }

        // 菜单栏那个位置不好找，Assets 面板右键也放一个
        [MenuItem("Assets/中文套式/导出关系数据", false, 2000)]
        private static void 右键导出()
        {
            导出关系数据();
        }

        private static string 项目根()
        {
            var 数据 = Application.dataPath;                       // ...\My project\Assets
            var 父 = Directory.GetParent(数据);
            return 父 != null && Directory.Exists(父.FullName) ? 父.FullName : null;
        }

        // ══════════════════════════════════════════════
        //  收脚本
        // ══════════════════════════════════════════════

        private sealed class 脚本信息
        {
            public string 名;
            public string 文件;
            public List<string[]> 字段 = new List<string[]>();  // [名, 类型]
        }

        private static List<脚本信息> 收脚本()
        {
            var 表 = new List<脚本信息>();
            foreach (var guid in AssetDatabase.FindAssets("t:MonoScript"))
            {
                var 路 = AssetDatabase.GUIDToAssetPath(guid);
                // 只要 Assets 下的；Packages 里的（TextMesh Pro 之类）不算用户自己的脚本
                if (string.IsNullOrEmpty(路) || !路.StartsWith("Assets/", StringComparison.Ordinal)) continue;

                var 资产 = AssetDatabase.LoadAssetAtPath<MonoScript>(路);
                if (资产 == null) continue;

                var 类 = 资产.GetClass();
                if (类 == null || !typeof(MonoBehaviour).IsAssignableFrom(类)) continue;

                var 信 = new 脚本信息 { 名 = 类.Name, 文件 = 路, 字段 = 读公开字段(类) };
                表.Add(信);
            }
            表.Sort((a, b) => string.CompareOrdinal(a.名, b.名));
            return 表;
        }

        private static List<string[]> 读公开字段(Type 类)
        {
            var 表 = new List<string[]>();
            FieldInfo[] 全部;
            try { 全部 = 类.GetFields(BindingFlags.Public | BindingFlags.Instance); }
            catch { return 表; }   // 反射失败就当没字段，不抛

            foreach (var 段 in 全部)
            {
                if (段.IsInitOnly || 段.IsNotSerialized) continue;
                if (!是配置项(段.FieldType)) continue;
                表.Add(new[] { 段.Name, 简体名(段.FieldType) });
            }
            return 表;
        }

        // 能在 Inspector 里显示的类型才算配置项
        private static bool 是配置项(Type t)
        {
            if (t == null) return false;
            if (t.IsPrimitive || t == typeof(string) || t.IsEnum) return true;
            if (typeof(UnityEngine.Object).IsAssignableFrom(t)) return true;
            if (t == typeof(Vector2) || t == typeof(Vector3) || t == typeof(Vector4)) return true;
            if (t == typeof(Quaternion) || t == typeof(Color) || t == typeof(Rect)) return true;
            if (t.IsArray) return 是配置项(t.GetElementType());
            if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(List<>)) return 是配置项(t.GetGenericArguments()[0]);
            return false;
        }

        private static string 简体名(Type t)
        {
            if (t == typeof(void)) return "void";
            if (t.IsArray) return 简体名(t.GetElementType()) + "[]";
            if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(List<>))
                return "List<" + 简体名(t.GetGenericArguments()[0]) + ">";
            var 常 = new Dictionary<Type, string>
            {
                { typeof(int), "int" }, { typeof(float), "float" }, { typeof(bool), "bool" },
                { typeof(string), "string" }, { typeof(double), "double" }, { typeof(long), "long" },
            };
            return 常.TryGetValue(t, out var 短) ? 短 : t.Name;
        }

        // ══════════════════════════════════════════════
        //  收预制体
        // ══════════════════════════════════════════════

        private sealed class 组件信息
        {
            public string 脚本;
            public int 实例ID;
            public Dictionary<string, string> 字段 = new Dictionary<string, string>();
            public List<string[]> 引用 = new List<string[]>();   // [字段名, 目标描述]
        }

        private sealed class 实例信息
        {
            public string 名;
            public string 路径;
            public string tag;
            public string 文件;
            public List<组件信息> 组件 = new List<组件信息>();
        }

        private static List<实例信息> 收预制体(Dictionary<string, 脚本信息> 白名单)
        {
            var 表 = new List<实例信息>();
            var 路径们 = new List<string>();
            foreach (var guid in AssetDatabase.FindAssets("t:Prefab"))
            {
                var 路 = AssetDatabase.GUIDToAssetPath(guid);
                if (string.IsNullOrEmpty(路) || !路.StartsWith("Assets/", StringComparison.Ordinal)) continue;
                路径们.Add(路);
            }
            路径们.Sort(StringComparer.Ordinal);

            foreach (var 路 in 路径们)
            {
                GameObject 根;
                try { 根 = PrefabUtility.LoadPrefabContents(路); }
                catch (Exception 错)
                {
                    // 读不了的要说话，不能当它不存在
                    Debug.LogWarning($"[中文套式] 读不了预制体 {路}：{错.Message}");
                    continue;
                }
                if (根 == null)
                {
                    Debug.LogWarning($"[中文套式] 预制体是空的：{路}");
                    continue;
                }

                try { 走物体(根, 根, 路, 白名单, 表); }
                finally { PrefabUtility.UnloadPrefabContents(根); }
            }
            return 表;
        }

        // ── 场景 ──────────────────────────────────
        // 场景用 additive 打开：不动用户当前场景，扫完立刻关掉。
        // 注意：运行时 Instantiate 出来的东西不在场景文件里，扫不到 —— 这是场景扫描的天花板，不是 bug。
        private static int 收场景(List<实例信息> 表, Dictionary<string, 脚本信息> 白名单)
        {
            var 场景们 = new List<string>();
            foreach (var guid in AssetDatabase.FindAssets("t:Scene"))
            {
                var 路 = AssetDatabase.GUIDToAssetPath(guid);
                if (string.IsNullOrEmpty(路) || !路.StartsWith("Assets/", StringComparison.Ordinal)) continue;
                场景们.Add(路);
            }
            场景们.Sort(StringComparer.Ordinal);

            var 个数 = 0;
            foreach (var 路 in 场景们)
            {
                Scene 场;
                try
                {
                    场 = EditorSceneManager.OpenScene(路, OpenSceneMode.Additive);
                }
                catch (Exception 错)
                {
                    Debug.LogWarning($"[中文套式] 打不开场景 {路}：{错.Message}");
                    continue;
                }

                try
                {
                    GameObject[] 根们;
                    try { 根们 = 场.GetRootGameObjects(); }
                    catch (Exception 错)
                    {
                        Debug.LogWarning($"[中文套式] 读不了场景根 {路}：{错.Message}");
                        continue;
                    }
                    foreach (var 根 in 根们)
                        走物体(根, 根, 路, 白名单, 表);
                    个数++;
                }
                finally
                {
                    // 一定要关：没关的话场景会一直挂在编辑器里，用户下次打开就乱了
                    if (场.IsValid()) EditorSceneManager.CloseScene(场, true);
                }
            }
            return 个数;
        }

        private static void 走物体(GameObject 根, GameObject 当前, string 文件,
                                   Dictionary<string, 脚本信息> 白名单, List<实例信息> 表)
        {
            var 件 = 读组件(当前, 白名单);
            if (件.Count > 0)
            {
                表.Add(new 实例信息
                {
                    名 = 当前.name,
                    路径 = 相对路径(根.transform, 当前.transform),
                    tag = 当前.tag,
                    文件 = 文件,
                    组件 = 件,
                });
            }
            foreach (Transform 子 in 当前.transform)
                走物体(根, 子.gameObject, 文件, 白名单, 表);
        }

        private static string 相对路径(Transform 根, Transform 当前)
        {
            var 链 = new List<string>();
            var t = 当前;
            while (t != null)
            {
                链.Add(t.name);
                if (t == 根) break;
                t = t.parent;
            }
            链.Reverse();
            return string.Join("/", 链);
        }

        private static List<组件信息> 读组件(GameObject 物, Dictionary<string, 脚本信息> 白名单)
        {
            var 表 = new List<组件信息>();
            MonoBehaviour[] 们;
            try { 们 = 物.GetComponents<MonoBehaviour>(); }
            catch (Exception 错)
            {
                Debug.LogWarning($"[中文套式] 读组件失败 {物.name}：{错.Message}");
                return 表;
            }

            foreach (var mb in 们)
            {
                if (mb == null) continue;   // 缺脚本留下来的空位，跳过
                var 类 = mb.GetType();
                // 只留用户自己写的脚本；引擎自带的 CanvasScaler / Image / Text 不进图
                if (!白名单.TryGetValue(类.Name, out var 剧本)) continue;

                var 允许 = new HashSet<string>(StringComparer.Ordinal);
                foreach (var 段 in 剧本.字段) 允许.Add(段[0]);

                var 记 = new 组件信息 { 脚本 = 类.Name, 实例ID = mb.GetInstanceID() };

                try
                {
                    var 序列 = new SerializedObject(mb);
                    var 走 = 序列.GetIterator();
                    var 有 = 走.NextVisible(true);
                    while (有)
                    {
                        if (走.name != "m_Script" && 允许.Contains(走.name))
                        {
                            if (走.propertyType == SerializedPropertyType.ObjectReference)
                                记.引用.Add(new[] { 走.name, 说目标(走.objectReferenceValue) });
                            else
                                记.字段[走.name] = 说值(走);
                        }
                        有 = 走.NextVisible(false);   // false：不钻进子项，数组只留一行
                    }
                }
                catch (Exception 错)
                {
                    Debug.LogWarning($"[中文套式] 读字段失败 {物.name} / {记.脚本}：{错.Message}");
                }

                表.Add(记);
            }
            return 表;
        }

        // ══════════════════════════════════════════════
        //  值 → 文字
        // ══════════════════════════════════════════════

        private static string 说值(SerializedProperty p)
        {
            try
            {
                switch (p.propertyType)
                {
                    case SerializedPropertyType.Integer:
                        return p.longValue.ToString(CultureInfo.InvariantCulture);
                    case SerializedPropertyType.Float:
                        return p.floatValue.ToString("0.####", CultureInfo.InvariantCulture);
                    case SerializedPropertyType.Boolean:
                        return p.boolValue ? "true" : "false";
                    case SerializedPropertyType.String:
                        return p.stringValue;
                    case SerializedPropertyType.Vector2:
                        return 点(p.vector2Value.x, p.vector2Value.y);
                    case SerializedPropertyType.Vector3:
                        return 点(p.vector3Value.x, p.vector3Value.y, p.vector3Value.z);
                    case SerializedPropertyType.Vector4:
                        return 点(p.vector4Value.x, p.vector4Value.y, p.vector4Value.z, p.vector4Value.w);
                    case SerializedPropertyType.Quaternion:
                        var 欧 = p.quaternionValue.eulerAngles;
                        return 点(欧.x, 欧.y, 欧.z);
                    case SerializedPropertyType.Color:
                        return "#" + ColorUtility.ToHtmlStringRGBA(p.colorValue);
                    case SerializedPropertyType.Rect:
                        return 点(p.rectValue.x, p.rectValue.y, p.rectValue.width, p.rectValue.height);
                    case SerializedPropertyType.Enum:
                        var 名们 = p.enumNames;
                        var 位 = p.enumValueIndex;
                        return (名们 != null && 位 >= 0 && 位 < 名们.Length) ? 名们[位] : p.intValue.ToString(CultureInfo.InvariantCulture);
                    case SerializedPropertyType.ObjectReference:
                        return 说目标(p.objectReferenceValue);
                    case SerializedPropertyType.Generic:
                        return p.isArray ? "[" + p.arraySize + "项]" : p.type;
                    default:
                        return p.propertyType.ToString();
                }
            }
            catch
            {
                return "?";
            }
        }

        private static string 点(params float[] 轴)
        {
            var 部 = new string[轴.Length];
            for (var i = 0; i < 轴.Length; i++) 部[i] = 轴[i].ToString("0.##", CultureInfo.InvariantCulture);
            return "(" + string.Join(", ", 部) + ")";
        }

        // 把「一个引用指向谁」说成人能核对的话
        private static string 说目标(UnityEngine.Object 目标)
        {
            if (目标 == null) return "";

            if (目标 is Component 件)
            {
                var 名 = 件.GetType().Name;
                if (件 is MonoBehaviour mb)
                {
                    var 资 = MonoScript.FromMonoBehaviour(mb);
                    if (资 != null)
                    {
                        var 类 = 资.GetClass();
                        if (类 != null) 名 = 类.Name;
                    }
                }
                return 位置(件.gameObject) + "#" + 名;
            }
            if (目标 is GameObject 物) return 位置(物);

            var 资产路 = AssetDatabase.GetAssetPath(目标);
            if (!string.IsNullOrEmpty(资产路)) return 资产路;
            return 目标.GetType().Name;
        }

        // 引用的两副面孔：指着场景里的一个东西，还是指着一个资产文件。
        // 混在一起说就分不清「enemyPrefab 指向 prefab 文件」和「指向场景里那个 enemy」。
        private static string 位置(GameObject 物)
        {
            if (物 == null) return "";
            if (EditorUtility.IsPersistent(物))
            {
                var 路 = AssetDatabase.GetAssetPath(物);
                if (!string.IsNullOrEmpty(路)) return 路;
            }
            return 路(物);
        }

        private static string 路(GameObject 物)
        {
            if (物 == null) return "";
            var 链 = new List<string>();
            var t = 物.transform;
            while (t != null) { 链.Add(t.name); t = t.parent; }
            链.Reverse();
            var 层 = string.Join("/", 链);

            // 不同场景里可能都有 Player —— 带上场景名才分得清。
            // 预制体预览场景不加前缀，否则 prefab 内部引用会变成一长串怪名字。
            var 场 = 物.scene;
            if (场.IsValid() && !string.IsNullOrEmpty(场.name) && !场.name.Contains("Preview"))
                return 场.name + ":" + 层;
            return 层;
        }

        // ══════════════════════════════════════════════
        //  拼 JSON（手写，不靠 JsonUtility —— 它不吃 Dictionary）
        // ══════════════════════════════════════════════

        private static string 拼JSON(string 根, List<脚本信息> 脚本, List<实例信息> 实例)
        {
            var j = new StringBuilder();
            j.Append("{\n");
            j.Append("  \"项目\": ").Append(串(Path.GetFileName(根))).Append(",\n");
            j.Append("  \"引擎\": ").Append(串(Application.unityVersion)).Append(",\n");
            j.Append("  \"导出时间\": ").Append(串(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture))).Append(",\n");

            // ---- 脚本 ----
            j.Append("  \"脚本\": [");
            for (var i = 0; i < 脚本.Count; i++)
            {
                if (i > 0) j.Append(',');
                var 信 = 脚本[i];
                j.Append("\n    {");
                j.Append("\"名\": ").Append(串(信.名)).Append(", ");
                j.Append("\"文件\": ").Append(串(信.文件)).Append(", ");
                j.Append("\"字段\": [");
                for (var k = 0; k < 信.字段.Count; k++)
                {
                    if (k > 0) j.Append(", ");
                    j.Append("{\"名\": ").Append(串(信.字段[k][0]))
                     .Append(", \"类型\": ").Append(串(信.字段[k][1])).Append('}');
                }
                j.Append("]}");
            }
            j.Append(脚本.Count > 0 ? "\n  ],\n" : "],\n");

            // ---- 物体 ----
            j.Append("  \"物体\": [");
            for (var i = 0; i < 实例.Count; i++)
            {
                if (i > 0) j.Append(',');
                var 实 = 实例[i];
                j.Append("\n    {");
                j.Append("\"名\": ").Append(串(实.名)).Append(", ");
                j.Append("\"路径\": ").Append(串(实.路径)).Append(", ");
                j.Append("\"tag\": ").Append(串(实.tag)).Append(", ");
                j.Append("\"文件\": ").Append(串(实.文件)).Append(", ");
                j.Append("\"组件\": [");
                for (var c = 0; c < 实.组件.Count; c++)
                {
                    if (c > 0) j.Append(", ");
                    var 件 = 实.组件[c];
                    j.Append("\n      {");
                    j.Append("\"脚本\": ").Append(串(件.脚本)).Append(", ");
                    j.Append("\"实例ID\": ").Append(件.实例ID).Append(", ");

                    j.Append("\"字段\": {");
                    var 先 = true;
                    foreach (var kv in 件.字段)
                    {
                        if (!先) j.Append(", ");
                        先 = false;
                        j.Append(串(kv.Key)).Append(": ").Append(串(kv.Value));
                    }
                    j.Append("}, ");

                    j.Append("\"引用\": {");
                    先 = true;
                    foreach (var r in 件.引用)
                    {
                        if (!先) j.Append(", ");
                        先 = false;
                        j.Append(串(r[0])).Append(": ").Append(串(r[1]));
                    }
                    j.Append("}}");
                }
                j.Append("]}");
            }
            j.Append(实例.Count > 0 ? "\n  ]\n" : "]\n");

            j.Append("}\n");
            return j.ToString();
        }

        private static string 串(string s)
        {
            if (s == null) return "null";
            var b = new StringBuilder(s.Length + 8);
            b.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': b.Append("\\\""); break;
                    case '\\': b.Append("\\\\"); break;
                    case '\n': b.Append("\\n"); break;
                    case '\r': b.Append("\\r"); break;
                    case '\t': b.Append("\\t"); break;
                    default:
                        if (c < 0x20) b.Append("\\u").Append(((int)c).ToString("x4"));
                        else b.Append(c);
                        break;
                }
            }
            b.Append('"');
            return b.ToString();
        }
    }

    // 保存场景就自动导一次。
    // 不这么做的话，每次改完都要记得点「工具/中文套式/导出关系数据」——
    // 忘了就是「编辑器里看不到刚加的东西」，而且他根本不知道要记得点。
    //
    // 只挂 sceneSaved，不挂定时器：定时导会在编辑时反复抢主线程。
    // 代价是「改了但没保存」仍然看不到 —— 那是 Unity 的性质，不是这里能绕过的。
    [InitializeOnLoad]
    internal static class 存盘就导出
    {
        static 存盘就导出()
        {
            EditorSceneManager.sceneSaved += _ =>
            {
                try { 关系桥.导出关系数据_安静(); }
                catch { /* 自动导出失败不该弹窗打断他保存 */ }
            };

            // Unity 刚打开这个项目时也导一次。
            // 不然刚把插件写进去的人，还得先存一次盘才看得到数据 ——
            // 那一步他根本不知道要做。
            // 用 delayCall 等 Unity 完全起来再跑，此时 AssetDatabase 才可用。
            EditorApplication.delayCall += () =>
            {
                try
                {
                    if (!File.Exists(关系桥.数据文件路径())) 关系桥.导出关系数据_安静();
                }
                catch { }
            };
        }
    }
}
