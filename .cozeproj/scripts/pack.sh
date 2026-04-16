# pack.sh - 通过 PID 文件精确杀掉自己上次的构建进程
WEAPP_PID_FILE="/tmp/coze-build_weapp.pid"
TT_PID_FILE="/tmp/coze-build_tt.pid"

cleanup_previous_build() {
    PID_FILE="$1"
    BUILD_NAME="$2"

    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "正在终止上次的 ${BUILD_NAME} 构建进程组 (PID: $OLD_PID)..."
            # kill 负数 PID = 杀掉整个进程组
            kill -9 -"$OLD_PID" 2>/dev/null
            sleep 1
        fi
        rm -f "$PID_FILE"
    fi
}

cleanup_previous_build "$WEAPP_PID_FILE" "weapp"
cleanup_previous_build "$TT_PID_FILE" "tt"

setsid sh -c 'export OUTPUT_ROOT=dist; pnpm build:weapp' &
WEAPP_PID=$!
echo "$WEAPP_PID" > "$WEAPP_PID_FILE"

setsid sh -c 'export OUTPUT_ROOT=dist-tt; pnpm build:tt' &
TT_PID=$!
echo "$TT_PID" > "$TT_PID_FILE"

echo "构建已并发启动 (weapp PID: $WEAPP_PID, tt PID: $TT_PID)"

WEAPP_STATUS=0
TT_STATUS=0

wait "$WEAPP_PID" || WEAPP_STATUS=$?
wait "$TT_PID" || TT_STATUS=$?

rm -f "$WEAPP_PID_FILE" "$TT_PID_FILE"

if [ "$WEAPP_STATUS" -ne 0 ]; then
    exit "$WEAPP_STATUS"
fi

if [ "$TT_STATUS" -ne 0 ]; then
    exit "$TT_STATUS"
fi
