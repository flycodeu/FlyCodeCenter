train_samples = [(1, 2), (2, 4)]
test_samples = [(3, 8), (4, 16)]


def predict(x, weight, bias):
    return x * weight + bias


# 传入哪组数据，就计算在哪组数据上的平均误差
def calculate_error(samples, weight, bias):
    total_error = 0

    for x, expected in samples:
        predicted = predict(x, weight, bias)
        total_error += abs(predicted - expected)

    return total_error / len(samples)


best_weight = None
best_bias = None
best_error = None

for weight in range(5):
    for bias in range(5):
        # 选参数时，只使用训练集
        error = calculate_error(train_samples, weight, bias)

        if best_error is None or error < best_error:
            best_weight = weight
            best_bias = bias
            best_error = error

# 参数已经确定，分别检查两组数据
train_error = calculate_error(train_samples, best_weight, best_bias)
test_error = calculate_error(test_samples, best_weight, best_bias)

print("weight =", best_weight, "bias =", best_bias)
print("训练平均误差：", train_error)
print("测试平均误差：", test_error)

for x, expected in test_samples:
    predicted = predict(x, best_weight, best_bias)
    print("输入：", x, "预测：", predicted, "正确答案：", expected)
