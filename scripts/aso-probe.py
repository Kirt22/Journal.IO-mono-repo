import json,time,urllib.parse,urllib.request,sys

TERMS = ["journal","journaling","diary","ai journal","ai diary","ai journaling",
"mood tracker","mood","gratitude journal","gratitude","self care","self reflection",
"reflection","mindfulness","mental health","therapy journal","dream journal",
"daily journal","private journal","secret diary","notes","wellbeing","wellness",
"anxiety","stress","habit tracker","journal prompts","guided journal",
"five minute journal","bullet journal","emotion tracker","feelings","mood diary",
"personal diary","thoughts","cbt","affirmations","self improvement","therapy",
"vent","daily check in","sleep tracker","journal app","ai therapist","mood journal",
"reflect","diary with lock","写日记","gratitude diary","voice journal","prompts"]

ME = 6770075245
out = {}
for t in TERMS:
    url = ("https://itunes.apple.com/search?" + urllib.parse.urlencode(
        {"term": t, "entity": "software", "country": "us", "limit": 200}))
    try:
        req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        d = json.load(urllib.request.urlopen(req, timeout=30))
    except Exception as e:
        out[t] = {"error": str(e)}; print(t, "ERR", e, flush=True); time.sleep(3); continue
    res = d.get("results", [])
    rank = next((i+1 for i,r in enumerate(res) if r.get("trackId")==ME), None)
    top = [{"n": r.get("trackName","")[:42], "r": r.get("userRatingCount",0)} for r in res[:5]]
    out[t] = {"total": len(res), "myRank": rank, "top": top}
    print(f"{t:22} n={len(res):3} me={rank}", flush=True)
    time.sleep(2)
json.dump(out, open("probe.json","w"), indent=1)
print("DONE")
