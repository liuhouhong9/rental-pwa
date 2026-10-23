// pages/index/index.js - 租客总表
const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    tenants: [],
    filtered: [],
    searchVal: '',
    houseList: [],
    filterHouse: '',
    filterStatus: 'all',
    sortKey: 'house',
    stats: { count: 0, vacant: 0, deposit: 0, income: 0, profit: 0, profitClass: '' },
    // 预计算的 class
    sortHouseClass: 'active',
    sortExpireClass: '',
    sortRentClass: '',
    filterAllClass: 'active',
    filterActiveClass: '',
    filterVacantClass: '',
    filterHouseAllClass: 'active',
    showHouseFilter: true
  },

  onShow() {
    app.reload();
    this.buildList();
    this.updateStats();
  },

  buildList() {
    let list = app.globalData.tenants.map((t, i) => ({ ...t, _idx: i }));
    const { searchVal, filterHouse, filterStatus, sortKey } = this.data;

    // 搜索
    if (searchVal) {
      const kw = searchVal.toLowerCase();
      list = list.filter(t =>
        (t.name && t.name.includes(kw)) ||
        t.house.toLowerCase().includes(kw) ||
        (t.room && t.room.toLowerCase().includes(kw)) ||
        (t.phone && t.phone.includes(kw))
      );
    }

    // 房源筛选
    if (filterHouse) {
      list = list.filter(t => t.house === filterHouse);
    }

    // 状态筛选
    if (filterStatus === 'active') {
      list = list.filter(t => t.status !== 'vacant');
    } else if (filterStatus === 'vacant') {
      list = list.filter(t => t.status === 'vacant');
    }

    // 排序
    if (sortKey === 'expire') {
      list.sort((a, b) => {
        if (a.status === 'vacant' && b.status !== 'vacant') return -1;
        if (a.status !== 'vacant' && b.status === 'vacant') return 1;
        const aEnd = a.end || '9999';
        const bEnd = b.end || '9999';
        return aEnd < bEnd ? -1 : aEnd > bEnd ? 1 : 0;
      });
    } else if (sortKey === 'rent') {
      list.sort((a, b) => (b.rent || 0) - (a.rent || 0));
    } else {
      list.sort((a, b) => {
        if (a.status === 'vacant' && b.status !== 'vacant') return 1;
        if (a.status !== 'vacant' && b.status === 'vacant') return -1;
        return a.house < b.house ? -1 : a.house > b.house ? 1 : 0;
      });
    }

    // 标注即将到期 + 待租时长 + 预计算 class
    const today = new Date().toISOString().slice(0, 10);
    list = list.map(t => {
      let days = null;
      let vacantDays = 0;
      const isVacant = t.status === 'vacant';
      if (isVacant && t.vacantSince) {
        vacantDays = util.daysBetween(today, t.vacantSince);
        if (vacantDays < 0) vacantDays = Math.abs(vacantDays);
      }
      if (t.end) {
        days = util.daysFromNow(t.end);
      }
      return {
        ...t,
        daysLeft: days,
        vacantDays,
        isVacant: isVacant,
        notVacant: !isVacant,
        isExpired: t.end && days !== null && days < 0 && !isVacant,
        isExpiring7: t.end && days !== null && days >= 0 && days <= 7 && !isVacant,
        isExpiring30: t.end && days !== null && days > 7 && days <= 30 && !isVacant,
        cardClass: isVacant ? 'card-vacant' : ''
      };
    });

    // 房源筛选列表（带 chipClass）
    const activeHousesEnum = [...new Set(
      app.globalData.tenants.filter(t => t.status !== 'vacant').map(t => t.house)
    )].sort();
    const houseList = activeHousesEnum.map(h => ({
      name: h,
      chipClass: filterHouse === h ? 'active' : ''
    }));

    this.setData({ filtered: list, houseList: houseList });
  },

  updateStats() {
    const tenants = app.globalData.tenants;
    const costs = app.globalData.costs;
    const expenses = app.globalData.expenses;

    const activeTenants = tenants.filter(t => t.status !== 'vacant');
    const vacantCount = tenants.filter(t => t.status === 'vacant').length;

    const count = activeTenants.length;
    const deposit = activeTenants.reduce((s, t) => s + (Number(t.deposit) || 0), 0);
    const income = activeTenants.reduce((s, t) => s + (Number(t.rent) || 0) + (Number(t.util) || 0), 0);

    // 成本和支出
    const houses = [...new Set(activeTenants.map(t => t.house))];
    let totalCost = 0;
    houses.forEach(h => {
      const exp = expenses[h] || {};
      totalCost += (Number(costs[h]) || 0) + (Number(exp.water) || 0) + (Number(exp.repair) || 0);
    });

    // 待租费用
    let vacantFee = 0;
    const depositIncome = app.globalData.depositIncome || {};
    let totalDepositInc = 0;
    tenants.filter(t => t.status === 'vacant' && t.vacantSince).forEach(t => {
      const marketRent = Number(t.marketRent) || 0;
      const vs = t.vacantSince;
      const days = Math.abs(util.daysBetween(new Date().toISOString().slice(0, 10), vs)) || 0;
      vacantFee += (marketRent / 30) * days;
    });
    Object.values(depositIncome).forEach(v => { totalDepositInc += Number(v) || 0; });

    const profit = income - totalCost - vacantFee + totalDepositInc;
    const profitPos = profit >= 0;

    this.setData({
      stats: {
        count,
        vacant: vacantCount,
        deposit: util.fmt(deposit),
        income: util.fmt(income),
        profit: (profitPos ? '+' : '') + util.fmt(profit),
        profitClass: profitPos ? 'green' : 'red'
      }
    });
  },

  onSearch(e) {
    this.setData({ searchVal: e.detail.value }, () => this.buildList());
  },

  onFilterHouseChip(e) {
    const val = e.currentTarget.dataset.value;
    const newVal = val === this.data.filterHouse ? '' : val;
    const filterHouseAllClass = newVal === '' ? 'active' : '';
    this.setData({ filterHouse: newVal, filterHouseAllClass: filterHouseAllClass }, () => this.buildList());
  },

  onFilterStatus(e) {
    const val = e.currentTarget.dataset.status;
    const showHouseFilter = val !== 'vacant';
    this.setData({
      filterStatus: val,
      filterAllClass: val === 'all' ? 'active' : '',
      filterActiveClass: val === 'active' ? 'active' : '',
      filterVacantClass: val === 'vacant' ? 'active' : '',
      showHouseFilter: showHouseFilter
    }, () => this.buildList());
  },

  onSortChange(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({
      sortKey: key,
      sortHouseClass: key === 'house' ? 'active' : '',
      sortExpireClass: key === 'expire' ? 'active' : '',
      sortRentClass: key === 'rent' ? 'active' : ''
    }, () => this.buildList());
  },

  goDetail(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.navigateTo({ url: `/pages/detail/detail?idx=${idx}` });
  },

  goEdit(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.navigateTo({ url: `/pages/add/add?idx=${idx}` });
  },

  // 标记退房（正常退租 / 违约退租）
  markVacant(e) {
    const idx = e.currentTarget.dataset.idx;
    const t = app.globalData.tenants[idx];
    const that = this;
    wx.showActionSheet({
      itemList: ['正常退租（押金退还）', '违约退租（押金没收）'],
      itemColor: '#1F4E78',
      success: res => {
        const isForfeit = res.tapIndex === 1; // 1 = 违约
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
              // 违约退租 → 押金计入违约所得
              if (isForfeit) {
                const di = app.globalData.depositIncome || {};
                di[t.house] = (Number(di[t.house]) || 0) + (Number(t.deposit) || 0);
                app.globalData.depositIncome = di;
              }
              app.globalData.tenants[idx] = {
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
              that.buildList();
              that.updateStats();
              wx.showToast({ title: `已${forfeitLabel}退租`, icon: 'success' });
            }
          }
        });
      }
    });
  },

  // 彻底删除
  confirmDelete(e) {
    const idx = e.currentTarget.dataset.idx;
    const t = app.globalData.tenants[idx];
    wx.showModal({
      title: '确认删除',
      content: `彻底删除【${t.house} ${t.room}】的待租记录？此操作不可撤销。`,
      confirmColor: '#e53935',
      success: res => {
        if (res.confirm) {
          app.globalData.tenants.splice(idx, 1);
          app.saveAll();
          this.buildList();
          this.updateStats();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  goAddForRoom(e) {
    const { house, room, market } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/add/add?prehouse=${encodeURIComponent(house)}&preroom=${encodeURIComponent(room)}&prerent=${market || ''}`
    });
  }
});
