const preferences = require("../preferences")

test("Validate exports", () => {
    expect(preferences).toHaveProperty('setMainWindow');
    expect(preferences).toHaveProperty('getCurrentPreferences');
    expect(preferences).toHaveProperty('openPreferences');
    expect(preferences).toHaveProperty('loadPreferences');
    expect(preferences).toHaveProperty('savePreferences');
    expect(preferences).toHaveProperty('closePreferences');
})

