using UnityEngine;
public class 敌人 : MonoBehaviour
{
    public int 血量 = 30;
    public int 分 = 10;
    public Transform 目标;
    void Start()
    {
        Debug.Log("敌人已生成");
    }
    public void 受伤(int 伤害)
    {
        血量 = 血量 - 伤害;
        Debug.Log("血量：" + 血量);
        if (血量 <= 0)
        {
            死亡();
        }
    }
    void 死亡()
    {
        Debug.Log("死亡，得分 +" + 分);
        if (目标 != null)
        {
            目标.position = new Vector3(0, 0, 0);
        }
        Destroy(gameObject,1);
    }
}
