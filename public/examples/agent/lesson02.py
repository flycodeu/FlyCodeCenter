samples = [(1, 2.5), (2, 5.0), (3, 7.5)]


# 使用当前参数进行预测
def predict(x, weight):
    return x * weight


# 用全部样例计算总误差
def calculate_error(weight):
    total_error = 0

    for x, expected in samples:
        predicted = predict(x, weight)
        total_error += abs(predicted - expected)

    return total_error


weight = 1.0  # 从这个初始参数出发
step = 0.1    # 每次试探调整的幅度（步长）

# 最多尝试 100 轮，避免一直停不下来
for attempt in range(100):
    current_error = calculate_error(weight)
    left_error = calculate_error(weight - step)
    right_error = calculate_error(weight + step)

    print("第", attempt + 1, "轮：weight =", round(weight, 4), "总误差 =", round(current_error, 4))

    # 往小调更好，并且不比往大调差
    if left_error < current_error and left_error <= right_error:
        weight -= step

    # 往大调更好
    elif right_error < current_error:
        weight += step

    # 两边都没有改善，提前结束循环
    else:
        break

print("学到的参数：", round(weight, 4))
print("总误差：", round(calculate_error(weight), 4))
print("输入 4，预测结果：", round(predict(4, weight), 4))
