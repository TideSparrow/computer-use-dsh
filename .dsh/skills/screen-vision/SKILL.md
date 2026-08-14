---
name: screen-vision
description: 用千问（Qwen-VL 多模态模型）识别屏幕截图并驱动 computer_* 模拟操作。当主模型不支持图像输入（computer_screenshot 报 "requires an image-capable model"）时使用：截图 → 调 Qwen-VL 拿到屏幕描述与元素坐标 → 据此执行 computer_click / computer_move / computer_scroll 等。也可用于纯图片理解（任意本地图片文件）。
---

# Screen Vision（千问多模态识别）

## 适用场景

- 主模型无图像输入能力，`computer_screenshot` 被 guard 拦截（报 `requires an image-capable model`）。
- 需要"看见"屏幕才能做 UI 自动化闭环：截图 → 理解 → 点击 → 再截图。
- 需要理解任意本地图片内容。

## 原理

本 skill 用 **bash + curl** 直接调用千问（阿里云 DashScope 兼容模式）的 Qwen-VL 多模态接口：

1. 用系统 `screencapture` 截图到本地文件（绕过插件 guard，只依赖 macOS Screen Recording 权限）；
2. 把图片 base64 编码后 POST 给 `qwen-vl-max` 等视觉模型；
3. 模型返回屏幕的文字描述、UI 元素及其坐标；
4. 依据坐标调用 `computer_click` / `computer_move` / `computer_scroll` / `computer_type` 完成操作闭环。

## 配置

配置在独立文件，换模型 / 换 key 无需改本 skill：

- 配置文件：项目根目录下的 `vision.config.json`。当前工作目录 `pwd` 即项目根时，直接读写 `vision.config.json`（绝对路径：`/Users/longpc/WorkSpace/Projects/TideSparrowPublic/computer-use-dsh/vision.config.json`）。若 `pwd` 不是项目根，先 `cd` 到项目根再操作。
- **API Key 绝不写入 `vision.config.json`**（该文件已在 .gitignore 中，但仍遵循最小暴露原则）。Key 的读取优先级：
  1. 环境变量 `DASHSCOPE_API_KEY`
  2. DSH 凭据库 `~/.dsh/.credentials.yaml` 中的 `DASHSCOPE_API_KEY` 字段
  3. （兜底）配置文件里的 `apiKey` 字段——仅当上面两者都不存在时才可填入，且填完后不要把文件提交到 git
- 可改：`model`（默认 `qwen-vl-max`，可换 `qwen-vl-plus`、`qwen3-vl-flash` 等）、`baseUrl`、`maxTokens`、`temperature`

如果三种来源都拿不到 key：**先停下，告诉用户需要配置 DashScope API Key（`export DASHSCOPE_API_KEY=sk-...` 或写入 `~/.dsh/.credentials.yaml`），不要猜测或使用占位符调用。**

## 操作步骤

### 1. 截图（macOS）

```bash
mkdir -p /tmp/dsh-vision && /usr/sbin/screencapture -x -t jpeg /tmp/dsh-vision/screen-$(date +%s).jpeg
```

- 整屏截图。如需指定区域：`/usr/sbin/screencapture -x -R <x>,<y>,<w>,<h> -t jpeg <out>`
- 失败时提示用户授予 Screen Recording 权限（系统设置 → 隐私与安全性 → 屏幕录制）。
- 保留刚生成的图片路径（如 `/tmp/dsh-vision/screen-123.jpeg`）供后续步骤使用。

> 若主模型支持图像输入（`computer_screenshot` 不报错），优先直接用 `computer_screenshot`，本 skill 仅在 guard 拦截时兜底。

### 2. 解析 API Key

按优先级取 key（写进调用脚本里，不要打印到聊天）：

```python
import os, json, yaml  # yaml 用 PyYAML，若无则用简单文本解析

def resolve_api_key(cfg):
    k = os.environ.get('DASHSCOPE_API_KEY')
    if k: return k
    try:
        creds = open(os.path.expanduser('~/.dsh/.credentials.yaml')).read()
        for line in creds.splitlines():
            if line.startswith('DASHSCOPE_API_KEY:'):
                return line.split(':', 1)[1].strip()
    except Exception:
        pass
    return (cfg.get('apiKey') or '').strip()
```

### 3. 调用 Qwen-VL 识别

> ⚠️ **不要用 `-d <内联JSON>` 传 payload**：截图 base64 后 payload 通常 >1MB，会触发 `OSError: [Errno 7] Argument list too long`。必须先把 payload 写入临时文件，再用 `curl -d @文件`。

```bash
python3 - <<'PY'
import base64, json, os, subprocess, tempfile

cfg = json.load(open('vision.config.json'))          # ← 替换为实际路径
img_path = '<上一步截图路径>'                          # ← 替换为实际截图路径
api_key = <第 2 步 resolve_api_key(cfg) 的返回值>      # ← 替换为解析出的 key，不要硬编码

b64 = base64.b64encode(open(img_path, 'rb').read()).decode()
payload = {
  "model": cfg["model"],
  "messages": [{
    "role": "user",
    "content": [
      {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
      {"type": "text", "text": "请详细描述这张屏幕截图的界面内容。列出：1) 页面整体是什么（应用/网站、当前状态）；2) 所有可见的重要文本内容（原样引用）；3) 所有可交互元素（按钮/输入框/链接/卡片）及其位置，用截图像素坐标 (x, y) 标注，左上角为原点；4) 按阅读顺序列出内容列表。用中文回答，坐标务必准确。"}
    ]
  }],
  "max_tokens": cfg.get("maxTokens", 1024),
  "temperature": cfg.get("temperature", 0.1)
}

# payload 写入临时文件，避免 ARG_MAX 报错
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
    json.dump(payload, f)
    payload_file = f.name

url = cfg["baseUrl"].rstrip('/') + "/chat/completions"
r = subprocess.run(["curl", "-s", "-X", "POST", url,
  "-H", "Authorization: Bearer " + api_key,
  "-H", "Content-Type: application/json",
  "-d", "@" + payload_file], capture_output=True, text=True, timeout=180)
os.unlink(payload_file)
out = json.loads(r.stdout)
if "choices" in out:
    print(out["choices"][0]["message"]["content"])
else:
    print("API ERROR:", json.dumps(out, ensure_ascii=False)[:800])
PY
```

### 4. 依据识别结果操作

- 模型给出的坐标是**截图像素坐标**，与 `computer_click` / `computer_move` / `computer_scroll` 的坐标空间一致（0,0 左上角），可直接使用。
- 操作后回到步骤 1 重新截图验证效果，形成"截图 → 理解 → 操作 → 再截图"闭环，直到任务完成。

## 注意事项

- 截屏文件会包含敏感信息，识别完可清理：`rm -f /tmp/dsh-vision/screen-*.jpeg`
- **API Key 安全**：key 只放环境变量或 `~/.dsh/.credentials.yaml`，不要写进本 skill、不要写进 `vision.config.json`、不要输出到聊天；`vision.config.json` 已在 .gitignore 中，禁止提交。
- DashScope 免费额度有限，长截图 / 高频调用注意 token 消耗；`maxTokens` 默认 1024，描述长页面可调大。
- 若 API 返回 401/403：检查 key 是否正确；若返回模型不存在：检查 `model` 字段是否为当前可用模型名（可先 `curl https://dashscope.aliyuncs.com/compatible-mode/v1/models -H "Authorization: Bearer <key>"` 列出）。
