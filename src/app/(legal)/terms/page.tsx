import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, OPERATOR_NAME, UPDATED_ON } from "@/lib/legal";

export const metadata: Metadata = { title: "服務條款｜Googoocard" };

// App 會用 WebView 顯示這頁：不要寫價格、方案或付款方式（App Store 3.1.3(f)）。
export default function TermsPage() {
  return (
    <>
      <h1>服務條款</h1>
      <p className="text-sm text-neutral-500">最後更新：{UPDATED_ON}</p>
      <p>使用 Googoocard（以下稱「本服務」）即表示你同意以下條款。</p>

      <h2>1. 服務內容</h2>
      <p>
        本服務讓舞蹈教室的老師和助教管理課程、學生、課卡、出席與收入，並讓學生透過 LINE 自助簽到和購買課卡。本服務由{" "}
        {OPERATOR_NAME} 個人經營。iOS App 是網頁版的配套 App，App 內不販售任何內容。
      </p>

      <h2>2. 帳號</h2>
      <ul>
        <li>請提供正確的資料，並妥善保管自己的密碼</li>
        <li>一個帳號只給一個人使用；要讓其他人協助管理教室，請用邀請成員的功能</li>
        <li>帳號底下發生的活動由帳號持有人負責</li>
      </ul>

      <h2>3. 教室與學生資料</h2>
      <ul>
        <li>教室裡的資料屬於教室。教室擁有者決定誰可以加入、管理這些資料</li>
        <li>
          你登錄學生資料（包括姓名、頭像、LINE 綁定）時，應確認已取得學生的同意，並依
          <Link href="/privacy">隱私權政策</Link>使用
        </li>
        <li>收款金額與付款狀態由教室自行記錄。本服務不經手任何款項，也不對教室與學生之間的交易負責</li>
      </ul>

      <h2>4. 禁止行為</h2>
      <ul>
        <li>試圖存取別人的帳號或其他教室的資料</li>
        <li>干擾、攻擊或過度使用服務（例如大量自動化請求）</li>
        <li>登錄違法、侵權或騷擾他人的內容</li>
      </ul>
      <p>違反條款時，我們可以暫停或終止你的帳號。</p>

      <h2>5. 服務的限制</h2>
      <ul>
        <li>本服務依「現況」提供，不保證不中斷或沒有錯誤</li>
        <li>推播通知可能延遲或沒有送達，重要的事情請以網頁或 App 裡的「待處理」為準</li>
        <li>停止整個服務前，會至少提前 30 天通知，讓你有時間匯出資料</li>
      </ul>

      <h2>6. 終止</h2>
      <p>你可以隨時停止使用，並在「帳號」頁刪除帳號，或依隱私權政策申請刪除。</p>

      <h2>7. 條款變更</h2>
      <p>條款有重大變更時，會更新本頁的日期並另行通知；變更後繼續使用，即表示你同意新的條款。</p>

      <h2>8. 準據法</h2>
      <p>本條款以中華民國（台灣）法律為準據法。</p>

      <h2>9. 聯絡我們</h2>
      <p>
        Email：<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </>
  );
}
