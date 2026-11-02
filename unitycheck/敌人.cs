using System.Collections.Generic;
using UnityEngine;

public class 敌人测试 : MonoBehaviour
    {
        public int 血量 = 100;
        private string 名字 = "小怪";
        protected float 速度 = 3.5f;
        public int 分数 { get; set; }
        public int 只读分 { get; }

        private void Start()
            {
                Debug.Log("开始");
                var 计数 = 0;
                var 骰子 = UnityEngine.Random.Range(1, 7);
                int[] 名单 = { 1, 2, 3 };
                var 待办 = new List<int>();
                待办.Add(1);
                待办.RemoveAt(0);
                待办.Clear();
                var 刚体 = GetComponent<Rigidbody>();
            }

        private void Update()
            {
                var 计数 = 0;
                int[] 名单 = { 1, 2, 3 };

                if (血量 <= 0)
                    {
                        Debug.Log("死了");
                    }
                else if (血量 < 30)
                    {
                        Debug.Log("危险");
                    }
                else
                    {
                        Debug.Log("安全");
                    }

                switch (计数)
                    {
                        case 1:
                            {
                                Debug.Log("一");
                                break;
                            }

                        case 2:
                            {
                                break;
                            }

                        default:
                            {
                                Debug.Log("其他");
                                break;
                            }
                    }

                for (int i = 0; i < 3; i++)
                    {
                        continue;
                    }

                while (计数 > 0)
                    {
                        计数 = 计数 - 1;
                    }

                foreach (var 项 in 名单)
                    {
                        Debug.Log(项);
                    }

                if (Input.GetKey(KeyCode.W))
                    {
                    }

                transform.Translate(0, 0, 1 * Time.deltaTime);
                transform.Rotate(0, 1, 0);
                transform.position = new Vector3(0, 1, 0);
                var 当前位置 = transform.position;
                Instantiate(gameObject);
                Destroy(gameObject, 0);
                gameObject.SetActive(false);
                Debug.LogWarning("小心");
                Debug.LogError("出错了");

                try
                    {
                        Debug.Log("试");
                    }
                catch
                    {
                        Debug.Log("捕");
                    }
            }

        public int 算分(int 基础)
            {
                return 基础 * 2;
            }
    }
