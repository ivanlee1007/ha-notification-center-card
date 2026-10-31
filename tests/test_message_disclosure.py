"""Real Chromium tests. Run: uv run --with playwright==1.58.0 python -m unittest discover -s tests -v
Uses installed Edge by default; set BROWSER_EXECUTABLE to another Chromium executable.
"""
import os
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VARIANTS = [
    ("dist/ha-notification-center-card.js", "ha-notification-center-card", ".body", ".name", ".desc"),
    ("dist/ha-notification-center-card.js", "notification-chip-card", ".notif-text", ".notif-title", ".notif-desc"),
    ("ha-notification-center-card.js", "ha-notification-center-card", ".body", ".name", ".desc"),
    ("ha-notification-center-card.js", "notification-chip-card", ".notif-text", ".notif-title", ".notif-desc"),
    ("notification-chip-card.js", "notification-chip-card", ".notif-text", ".notif-title", ".notif-desc"),
]


class MessageDisclosureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        executable = os.environ.get("BROWSER_EXECUTABLE", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
        cls.browser = cls.playwright.chromium.launch(executable_path=executable, headless=True)
        print("Browser:", cls.browser.version, flush=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def mount(self, variant):
        filename, tag, body, title, desc = variant
        page = self.browser.new_page(viewport={"width": 800, "height": 900})
        self.addCleanup(page.close)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        self.addCleanup(lambda: self.assertEqual(errors, [], 'browser runtime errors'))
        page.set_content('<style>body {margin: 8px} #fixture {width:360px}</style><div id="fixture"></div>')
        page.add_script_tag(content=(ROOT / filename).read_text(encoding="utf-8"), type="module")
        page.evaluate('tag => customElements.whenDefined(tag)', tag)
        page.evaluate("""tag => {
          window.calls = []; window.infos = [];
          window.items = Array.from({length: 12}, (_, i) => ({source_id: 'source-' + i,
            name: '標題 ' + 'LongTitle'.repeat(30), description: '第一行\n' + 'X'.repeat(320) + '\n最後一行',
            priority: 'info', type: 'manual', tap_action_entity: 'sensor.test'}));
          window.refresh = (items = window.items) => {
            window.items = items;
            window.card.hass = {states: {
              'sensor.notification_feed': {state: String(items.length), attributes: {notifications: items}},
              'sensor.other': {state: String(items.length), attributes: {notifications: items}}
            }, callService: (...args) => window.calls.push(args),
            navigatePath: (...args) => window.calls.push(args)};
          };
          window.card = document.createElement(tag);
          card.setConfig({entity: 'sensor.notification_feed', default_open: true});
          card.addEventListener('hass-more-info', e => infos.push(e.detail));
          document.querySelector('#fixture').append(card); refresh();
        }""".replace("第一行\n", "第一行\\n").replace("\n最後一行", "\\n最後一行"), tag)
        return page, page.locator(tag).locator(body).first

    def test_scrolled_list_keeps_node_focus_and_scroll_during_toggle(self):
        for variant in VARIANTS:
            with self.subTest(variant=variant[:2]):
                page, _ = self.mount(variant)
                message = page.locator(variant[1]).locator(variant[2]).nth(8)
                message.scroll_into_view_if_needed()
                message.focus()
                before = message.evaluate('''el => {
                  window.retainedMessage = el;
                  window.scroller = card.shadowRoot.querySelector('.notif-list, .dropdown');
                  return scroller.scrollTop;
                }''')
                self.assertGreater(before, 0)
                message.press('Enter')
                self.assertTrue(message.evaluate('(el) => el === retainedMessage && el.getRootNode().activeElement === el'))
                self.assertEqual(page.evaluate('scroller.scrollTop'), before)
                message.press('Space')
                self.assertEqual(page.evaluate('scroller.scrollTop'), before)

    def test_message_is_literal_text_including_markup(self):
        for variant in VARIANTS:
            with self.subTest(variant=variant[:2]):
                page, message = self.mount(variant)
                page.evaluate('refresh([{...items[0], name: "<b>literal title</b>", description: "<em>literal description</em>"}])')
                self.assertEqual(message.locator(variant[3]).text_content(), '<b>literal title</b>')
                self.assertEqual(message.locator(variant[4]).text_content(), '<em>literal description</em>')
                message.click()
                self.assertEqual(message.get_attribute('aria-expanded'), 'true')

    def test_refresh_preserves_by_source_id_but_removed_ids_are_pruned(self):
        for variant in VARIANTS:
            with self.subTest(variant=variant[:2]):
                page, message = self.mount(variant)
                message.click()
                page.evaluate('refresh(items.map(n => ({...n, description: n.description + " updated"})).reverse())')
                original = page.locator(variant[1]).locator('.notif-item[data-source="source-0"]').locator(variant[2])
                self.assertEqual(original.get_attribute('aria-expanded'), 'true')
                page.evaluate('window.saved = items.find(n => n.source_id === "source-0"); refresh(items.filter(n => n !== saved))')
                page.evaluate('refresh([saved, ...items])')
                self.assertEqual(original.get_attribute('aria-expanded'), 'false', 'removed IDs must not resurrect expanded')

    def test_different_feed_resets_disclosure(self):
        for variant in VARIANTS:
            with self.subTest(variant=variant[:2]):
                page, message = self.mount(variant)
                message.click()
                page.evaluate('card.setConfig({entity: "sensor.other", default_open: true}); refresh()')
                self.assertEqual(message.get_attribute('aria-expanded'), 'false')

    def test_dedicated_actions_remain_separate(self):
        for variant in VARIANTS:
            with self.subTest(variant=variant[:2]):
                page, message = self.mount(variant)
                message.click()
                item = page.locator(variant[1]).locator('.notif-item').first
                item.locator('.more-btn').click()
                self.assertEqual(message.get_attribute('aria-expanded'), 'true')
                self.assertEqual(page.evaluate('calls.length + infos.length'), 0)
                item.locator('.more-info-btn').click()
                self.assertEqual(page.evaluate('infos'), [{'entityId': 'sensor.test'}])
                self.assertEqual(message.get_attribute('aria-expanded'), 'true')
                item.locator('[data-hours="1"]').click()
                self.assertEqual(page.evaluate('calls'), [['ha_notification_center', 'snooze', {'source_id': 'source-0', 'duration_hours': 1}]])
                self.assertEqual(message.get_attribute('aria-expanded'), 'true')

    def test_keyboard_toggles_in_place_without_scrolling_or_actions(self):
        for variant in VARIANTS:
            with self.subTest(variant=variant[:2]):
                page, message = self.mount(variant)
                message.focus()
                message.evaluate('(el) => window.originalMessage = el')
                before = page.evaluate('window.scrollY')
                message.press('Enter')
                self.assertEqual(message.get_attribute('aria-expanded'), 'true')
                message.press('Space')
                self.assertEqual(message.get_attribute('aria-expanded'), 'false')
                self.assertTrue(message.evaluate('(el) => el === originalMessage && el.getRootNode().activeElement === el'))
                self.assertEqual(page.evaluate('window.scrollY'), before)
                self.assertEqual(page.evaluate('calls.length + infos.length'), 0)

    def test_click_reveals_full_message_then_collapses_without_more_info(self):
        for variant in VARIANTS:
            with self.subTest(variant=variant[:2]):
                page, message = self.mount(variant)
                title = message.locator(variant[3])
                desc = message.locator(variant[4])
                folded = title.evaluate('(el) => el.clientHeight')
                self.assertEqual(title.evaluate('(el) => getComputedStyle(el).whiteSpace'), 'nowrap')
                message.click()
                self.assertGreater(title.evaluate('(el) => el.clientHeight'), folded, 'click must reveal full title')
                self.assertEqual(message.get_attribute('aria-expanded'), 'true')
                self.assertEqual(desc.evaluate('(el) => getComputedStyle(el).whiteSpace'), 'pre-wrap')
                self.assertTrue(desc.evaluate('(el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1'))
                self.assertEqual(page.evaluate('calls.length + infos.length'), 0)
                message.click()
                self.assertEqual(message.get_attribute('aria-expanded'), 'false')
                self.assertEqual(title.evaluate('(el) => el.clientHeight'), folded)


if __name__ == '__main__':
    unittest.main()
