import { describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'

import App from '../App.vue'

describe('App', () => {
  it('掛載後渲染出上傳畫面', async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/', component: () => import('../views/HomeView.vue') }],
    })
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router, createPinia()] } })
    expect(wrapper.text()).toContain('不動產估價案件審查')
    expect(wrapper.text()).toContain('把查估書表 PDF 拖進來')
  })
})
