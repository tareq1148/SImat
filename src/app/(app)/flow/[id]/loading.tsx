// هيكل انتظار مساحة عمل المسار.
//
// الهيكل العام يرسم صفحةً موثّقةً متوسّطة العرض، وهذه الشاشة شطران يملآن
// الشاشة: المحادثة رُبعًا واللوحة ثلاثة أرباع. فكان فتح المسار قفزةً من عمودٍ
// ضيّق إلى تقسيمٍ مغاير. هنا نرسم الشطرين بأصنافهما نفسها — ws-root وws-chat
// وws-canvas — فيثبت التخطيط منذ اللحظة الأولى ولا يتبدّل إلا امتلاؤه.
//
// ولا نُدخل اللوحة بحركتها: مِفتاح wsCanvasIn يبقى للّوحة الحقيقية وحدها،
// وإلا انزلق الشطر مرّتين — مرّة هيكلًا ومرّة محتوى.

export default function FlowLoading() {
  return (
    <main className="ws-root is-split" aria-busy="true" aria-label="جارٍ فتح المسار">
      <section className="ws-chat">
        <div className="flex-1 overflow-hidden py-6 space-y-4 w-full">
          {/* المستخدم يمنة السطر والمساعد يسرته — كترتيب المحادثة نفسه */}
          <Bubble side="end" className="w-[85%] h-16" />
          <Bubble side="start" className="w-[58%] h-11" />
          <Bubble side="end" className="w-[92%] h-24" />
          <Bubble side="start" className="w-[44%] h-11" />
          <Bubble side="end" className="w-[76%] h-16" />
        </div>

        <div className="pt-2 pb-5">
          <div className="skeleton h-16 w-full rounded-full" />
        </div>
      </section>

      <section className="ws-canvas" style={{ animation: "none" }}>
        <div className="ws-canvas-inner">
          <header className="ws-bar">
            <div className="skeleton h-4 w-44 rounded-md" />
            {/* مقاسا «اختبار» و«اعتماد» كما يقيسهما المتصفّح — فلا يعلو
                الشريط ولا ينخفض حين يحلّ الزرّان محلّ الهيكل */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="skeleton h-10 w-[70px] rounded-[10px]" />
              <div className="skeleton h-10 w-[79px] rounded-[10px]" />
            </div>
          </header>

          {/* سلسلة العقد كما ترسمها اللوحة: دائرة ٥٢ تحتها الاسم، والمسافة
              بين المركزين ٢١٠. المقاسات أساسٌ مرن لا مقدارٌ ثابت، فتنكمش
              السلسلة مع الشطر بدل أن تُقصّ عند حافّته — واللوحة الحقيقية
              تُقوّم رسمها على الحيّز كذلك (fitView)، فلا تُقصّ هي أيضًا. */}
          <div className="flex-1 min-h-0 grid place-items-center overflow-hidden px-6">
            <div className="flex items-start w-full max-w-[754px]">
              <GraphNode />
              <GraphEdge />
              <GraphNode />
              <GraphEdge />
              <GraphNode />
              <GraphEdge />
              <GraphNode />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Bubble({ side, className }: { side: "start" | "end"; className: string }) {
  return (
    <div className={`flex ${side === "start" ? "justify-start" : "justify-end"}`}>
      <div className={`skeleton rounded-2xl ${className}`} />
    </div>
  );
}

function GraphNode() {
  return (
    <div className="grow shrink basis-[124px] min-w-[52px] flex flex-col items-center gap-2">
      <div className="skeleton w-[52px] h-[52px] rounded-full shrink-0" />
      <div className="skeleton h-3 w-[70%] max-w-16 rounded" />
    </div>
  );
}

function GraphEdge() {
  return <div className="skeleton grow shrink basis-[86px] min-w-0 h-[2px] mt-[25px] rounded-full" />;
}
