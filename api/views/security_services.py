SCORE_WINDOW_DAYS = 30  # 점수 계산에 반영하는 최근 기간(일)
SCORE_SUSPECT_WEIGHT = 0.3  # 의심 통과 1건을 차단 0.3건으로 계산
SCORE_MIN_ACTIVITY = 20  # 활동이 적을 때 몇 건만으로 점수가 급락하지 않도록 하는 최소 분모
SCORE_MISMATCH_PENALTY = 15


def calculate_security_score(pass_cnt, block_cnt, suspect_cnt, mismatch_cnt):
    """활동 대비 위험 비율로 건전성 점수를 낸다. pass_cnt는 의심 통과를 포함한 통과 건수다."""
    risk = block_cnt + suspect_cnt * SCORE_SUSPECT_WEIGHT
    ratio = risk / max(pass_cnt + block_cnt, SCORE_MIN_ACTIVITY)
    score = round(100 * (1 - ratio))
    # 위험 활동이 한 건이라도 있으면 반올림으로 만점이 되지 않게 한다
    if risk > 0:
        score = min(score, 99)
    return max(0, score - mismatch_cnt * SCORE_MISMATCH_PENALTY)


def generate_advisor_message(score, pass_cnt, block_cnt, suspect_cnt, mismatch_cnt):
    if block_cnt == suspect_cnt == mismatch_cnt == 0:
        msg = ["보안 상태 매우 건전함."]
    elif score < 50:
        msg = ["**[위험]** 건전성 심각 저하."]
    elif score < 90:
        msg = ["**[주의]** 위험 활동 증가."]
    else:
        msg = ["**[관찰]** 위험 활동 일부 탐지."]
    total = pass_cnt + block_cnt
    if total > 0:
        msg.append(
            f"최근 {SCORE_WINDOW_DAYS}일 활동 {total}건: 통과 {pass_cnt}건, 차단 {block_cnt}건 "
            f"(준수율 {round(pass_cnt / total * 100)}%)"
        )
    msg.append(f"의심 통과 {suspect_cnt}건, MAC 변조 {mismatch_cnt}건")
    return "\n".join(msg)
