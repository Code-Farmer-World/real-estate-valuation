import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'

import App from '../App.vue'

/**
 * 首屏有兩種模式。預設是產出模式（從勘查表算出該填什麼），那是正式題目要的；
 * 審查模式（比對已填好的書表）在另一個分頁。
 *
 * 兩者各自獨立：產出走 xlsx（格位對映，結構化），審查走 PDF（座標比對，
 * 綁版面）。其中一條失敗不影響另一條，所以測試也分開驗。
 */
async function mountApp() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/', component: () => import('../views/HomeView.vue') }],
  })
  router.push('/')
  await router.isReady()
  return mount(App, { global: { plugins: [router, createPinia()] } })
}

describe('App', () => {
  it('掛載後渲染出標題與兩種模式的切換', async () => {
    const wrapper = await mountApp()
    expect(wrapper.text()).toContain('不動產估價案件審查')
    expect(wrapper.text()).toContain('產出模式')
    expect(wrapper.text()).toContain('審查模式')
  })

  it('預設顯示產出模式的上傳區', async () => {
    const wrapper = await mountApp()
    expect(wrapper.text()).toContain('把填好的表3 xlsx 拖進來')
    // 只接受 xlsx。收 PDF 的是審查模式那條路
    const input = wrapper.find('input[type="file"]')
    expect(input.attributes('accept')).toBe('.xlsx')
  })

  it('切到審查模式後才出現 PDF 上傳區', async () => {
    const wrapper = await mountApp()
    const tabs = wrapper.findAll('[role="tab"]')
    const review = tabs.find((t) => t.text().includes('審查模式'))
    expect(review).toBeDefined()
    await review!.trigger('click')
    expect(wrapper.text()).toContain('把查估書表 PDF 拖進來')
  })

  it('啟動時不打任何 API，後端關著畫面也要出來', async () => {
    // src/ 裡沒有任何 onMounted 會呼叫 API，這條守住那個前提。
    // 若哪天有人在 store 或元件加了自動載入，這裡會因為 fetch 未被 mock 而爆。
    const wrapper = await mountApp()
    expect(wrapper.text()).toContain('不動產估價案件審查')
  })
})
