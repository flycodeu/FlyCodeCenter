# 每一组都是：（输入，正确答案）
samples = [(1, 2), (2, 4), (3, 6)]


# 给定输入和参数，计算预测结果
def predict(x, weight):
    return x * weight


# None 表示暂时还没有最优记录
best_weight = None
best_error = None

# 依次尝试四个候选参数
for weight in [1, 2, 3, 4]:
    total_error = 0

    # 用每一组样例检查当前参数
    for x, expected in samples:
        predicted = predict(x, weight)
        error = abs(predicted - expected)
        total_error += error

    print("尝试参数：", weight, "总误差：", total_error)

    # 第一次直接记录；之后只保留总误差更小的参数
    if best_error is None or total_error < best_error:
        best_weight = weight
        best_error = total_error

print("学到的参数：", best_weight)
print("输入 4，预测结果：", predict(4, best_weight))
