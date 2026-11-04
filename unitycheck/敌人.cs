using System.Collections.Generic;
using UnityEngine;

public class 玩家 : MonoBehaviour
    {
        public int 血量 = 100;
        public List<int> 队伍;

        void Start()
            {
                Debug.Log("开始");
            }

        void Update()
            {
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

                血量 = 血量 - 1;
            }

        void 重置()
            {
                for (int i = 0; i < 3; i++)
                    {
                        队伍.Add(1);
                    }

                队伍.Clear();
            }
    }
