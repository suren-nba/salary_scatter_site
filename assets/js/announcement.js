const announcement = document.createElement("section");
announcement.className = "site-announcement";
announcement.setAttribute("role", "dialog");
announcement.setAttribute("aria-modal", "true");
announcement.setAttribute("aria-labelledby", "siteAnnouncementTitle");
announcement.setAttribute("aria-describedby", "siteAnnouncementCopy");

announcement.innerHTML = `
  <div class="site-announcement__card">
    <button class="site-announcement__close" type="button" aria-label="关闭公告">&times;</button>
    <div class="site-announcement__message">
      <p class="site-announcement__eyebrow">网站停运公告</p>
      <h2 id="siteAnnouncementTitle">本站将于 <time datetime="2026-08-21">2026.8.21</time> 暂停运行并关闭</h2>
      <p id="siteAnnouncementCopy" class="site-announcement__copy">本站的全部数据与内容现已迁移至 SuRen NBA 主站，后续请前往主站继续查看球员薪资数据。</p>
    </div>
    <div class="site-announcement__actions">
      <a class="site-announcement__primary" href="https://www.surennba.com/salary">前往主站查看数据&nbsp;→</a>
      <button class="site-announcement__secondary" type="button">继续浏览本站</button>
    </div>
  </div>
`;

const closeButtons = announcement.querySelectorAll("button");
const closeAnnouncement = () => {
  announcement.hidden = true;
  document.body.classList.remove("has-site-announcement");
};

closeButtons.forEach((button) => button.addEventListener("click", closeAnnouncement));
announcement.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAnnouncement();
});

document.body.append(announcement);
document.body.classList.add("has-site-announcement");
announcement.querySelector(".site-announcement__close").focus();
