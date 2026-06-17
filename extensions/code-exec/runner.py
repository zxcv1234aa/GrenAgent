"""Persistent Python execution kernel for the Pi code-exec extension.

Reads NDJSON commands from stdin, executes code in a persistent namespace, and
writes one NDJSON result line per command to the original stdout. Captured
print() output plus the value of a trailing expression are returned each time;
variables and imports persist across commands until a reset.
"""

import ast
import contextlib
import io
import json
import sys
import traceback

_globals = {"__name__": "__main__"}
# 真实 stdout：执行期间 sys.stdout 会被重定向去捕获 print，结果走这个原始句柄。
_out = sys.stdout


def _run(code):
    buf_out, buf_err = io.StringIO(), io.StringIO()
    value = None
    ok = True
    error = None
    try:
        tree = ast.parse(code, mode="exec")
        last_expr = None
        # 末尾若是表达式，单独 eval 取值（像 REPL 回显），其余语句正常 exec。
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last_expr = ast.Expression(tree.body.pop().value)
        with contextlib.redirect_stdout(buf_out), contextlib.redirect_stderr(buf_err):
            if tree.body:
                exec(compile(tree, "<cell>", "exec"), _globals)
            if last_expr is not None:
                result = eval(compile(last_expr, "<cell>", "eval"), _globals)
                if result is not None:
                    value = repr(result)
    except BaseException:  # 含 KeyboardInterrupt：捕获后内核存活，仅本条 exec 失败
        ok = False
        error = traceback.format_exc()
    return {
        "stdout": buf_out.getvalue(),
        "stderr": buf_err.getvalue(),
        "value": value,
        "ok": ok,
        "error": error,
    }


def _emit(obj):
    _out.write(json.dumps(obj, ensure_ascii=False) + "\n")
    _out.flush()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue
        mtype = msg.get("type")
        mid = msg.get("id")
        if mtype == "exec":
            res = _run(msg.get("code", ""))
            res["type"] = "result"
            res["id"] = mid
            _emit(res)
        elif mtype == "reset":
            _globals.clear()
            _globals["__name__"] = "__main__"
            _emit({"type": "result", "id": mid, "stdout": "", "stderr": "",
                   "value": None, "ok": True, "error": None})
        elif mtype == "ping":
            _emit({"type": "pong", "id": mid})
        else:
            _emit({"type": "result", "id": mid, "stdout": "", "stderr": "",
                   "value": None, "ok": False, "error": "unknown command type: %r" % (mtype,)})


if __name__ == "__main__":
    main()
