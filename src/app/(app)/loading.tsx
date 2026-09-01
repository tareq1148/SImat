// هيكل انتظار للقسم المسجَّل — بدونه يبقى المستخدم على الصفحة القديمة
// حتى يكتمل تصيير الخادم، فيبدو التنقل جامدًا ثانيتين رغم أن الخادم يرد أسرع.
// الشريط العلوي والجانبي يبقيان (فهما في التخطيط لا في الصفحة)، ونملأ المحتوى فقط.
export default function AppLoading() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 space-y-4">
      <div className="skeleton h-9 w-56 rounded-xl" />
      <div className="grid sm:grid-cols-2 gap-4 pt-2">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
      </div>
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}
