// pages/detail/detail.js - 租客详情
const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    tenant: null,
    idx: -1,
    isVacant: false,
    notVacant: false,
    heroClass: '',
    vacantDays: 0,
    vacantFee: 0,
    utilText: ''
  },

  onLoad(options) {
    const idx = parseInt(options.idx);
    app.reload();
    this.loadTenant(idx);
  },

  loadTenant(idx) {
    const t = app.globalData.tenants[idx];
    if (!t) return;
    const isVacant = t.status === 'vacant';
    const notVacant = !isVacant;
    const heroClass = isVacant ? 'hero-vacant' : '';

    // 待租天数 & 待租费用
    let vacantDays = 0;
    let vacantFee = 0;
    if (isVacant && t.vacantSince) {
      vacantDays = util.daysBetween(new Date().toISOString().slice(0, 10), t.vacantSince);
      if (vacantDays < 0) vacantDays = Math.abs(vacantDays);
      const marketRent = Number(t.marketRent) || 0;
      vacantFee = Math.round(marketRent / 30);
    }

    // 水燃文字（避免模板里 ! 运算）
    const utilText = isVacant ? '—' : ('¥' + (t.util || 0));

    this.setData({
      tenant: t,
      idx,
      isVacant,
      notVacant,
      heroClass,
      vacantDays: vacantDays || '—',
      vacantFee,
      utilText
    });
  },

  onShow() {
    app.reload();
    this.loadTenant(this.data.idx);
  },

  // 一键拨号
  callPhone() {
    const phone = this.data.tenant.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },

  // 编辑
  goEdit() {
    wx.navigateTo({ url: `/pages/add/add?idx=${this.data.idx}` });
  },

  // 标记退房（正常退租 / 违约退租）
  markVacant() {
    if (this.data.isVacant) return;
    const t = this.data.tenant;
    const that = this;
    wx.showActionSheet({
      itemList: ['正常退租（押金退还）', '违约退租（押金没收）'],
      itemColor: '#1F4E78',
      success: res => {
        const isForfeit = res.tapIndex === 1;
        const forfeitLabel = isForfeit ? '违约' : '正常';
        const forfeitNote = isForfeit
          ? `\n⚠ 押金 ¥${t.deposit || 0} 将计入押金违约所得！`
          : '\n✅ 押金 ¥' + (t.deposit || 0) + ' 全额退还，不计入违约所得。';
        wx.showModal({
          title: `确认${forfeitLabel}退租`,
          content: `【${t.house} ${t.room} - ${t.name}】${forfeitNote}\n房间将保留为待租房源。`,
          confirmColor: isForfeit ? '#E65100' : '#1F4E78',
          success: modalRes => {
            if (modalRes.confirm) {
              const today = new Date().toISOString().slice(0, 10);
              if (isForfeit) {
                const di = app.globalData.depositIncome || {};
                di[t.house] = (Number(di[t.house]) || 0) + (Number(t.deposit) || 0);
                app.globalData.depositIncome = di;
              }
              app.globalData.tenants[that.data.idx] = {
                ...t,
                status: 'vacant',
                vacantSince: today,
                marketRent: t.rent || 0,
                name: '',
                phone: '',
                deposit: 0,
                rent: 0,
                util: 0,
                start: '',
                end: '',
                paytype: '',
                received: 0,
                note: (t.note || '') + `[${forfeitLabel}退租于${today}]`
              };
              app.saveAll();
              that.loadTenant(that.data.idx);
              wx.showToast({ title: `已${forfeitLabel}退租`, icon: 'success' });
            }
          }
        });
      }
    });
  },

  // 彻底删除
  confirmDelete() {
    const t = this.data.tenant;
    wx.showModal({
      title: '确认删除',
      content: `彻底删除【${t.house} ${t.room}】的待租记录？`,
      confirmColor: '#e53935',
      success: res => {
        if (res.confirm) {
          app.globalData.tenants.splice(this.data.idx, 1);
          app.saveAll();
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1000);
        }
      }
    });
  },

  // 录入新租客
  goAddForRoom() {
    const t = this.data.tenant;
    wx.navigateTo({
      url: `/pages/add/add?prehouse=${encodeURIComponent(t.house)}&preroom=${encodeURIComponent(t.room)}&prerent=${t.marketRent || ''}`
    });
  }
});
