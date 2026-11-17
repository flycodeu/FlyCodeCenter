samples = [(1, 5), (2, 8), (3, 11)]


# 模型现在有两个参数
def predict(x, weight, bias):
    return x * weight + bias


# 检查这组参数在全部样例上的总误差
def calculate_error(weight, bias):
    total_error = 0

    for x, expected in samples:
        predicted = predict(x, weight, bias)
        total_error += abs(predicted - expected)

    return total_error


best_weight = None
best_bias = None
best_error = None

# range(5) 依次产生 0、1、2、3、4
for weight in range(5):
    for bias in range(5):
        error = calculate_error(weight, bias)

        # 保留误差最小的一整组参数
        if best_error is None or error < best_error:
            best_weight = weight
            best_bias = bias
            best_error = error

print("weight =", best_weight)
print("bias =", best_bias)
print("总误差 =", best_error)
print("输入 4，预测结果 =", predict(4, best_weight, best_bias))
