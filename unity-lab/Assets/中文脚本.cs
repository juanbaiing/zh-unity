using UnityEngine;

public class 中文脚本 : MonoBehaviour
{
    void Start()
    {
        var list = new[] { 1, 2, 3, 4, 5 };

        foreach (var x in list) {
            if (x > 2) {
                Debug.Log(x);
            } else {
                Debug.Log(0);
            }
        }

        for (int i = 0; i < 3; i++) {
            Debug.Log("喘口气");
        }

    }
}
