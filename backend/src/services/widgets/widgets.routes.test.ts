import assert from "node:assert/strict";
import test from "node:test";
import widgetsRouter from "./widgets.routes";

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: { name: string } }>;
  };
};

const registeredRoutes = () =>
  (widgetsRouter.stack as unknown as RouteLayer[])
    .map(layer => layer.route)
    .filter((route): route is NonNullable<RouteLayer["route"]> => Boolean(route));

test("widget routes scope JWT and Widget credentials to their intended endpoints", () => {
  const routes = registeredRoutes();
  const createSessionRoute = routes.find(
    route => route.path === "/session" && route.methods.post
  );
  const deleteSessionRoute = routes.find(
    route => route.path === "/session" && route.methods.delete
  );
  const moodRoute = routes.find(
    route => route.path === "/mood/check_in" && route.methods.post
  );

  assert.deepEqual(
    createSessionRoute?.stack.map(layer => layer.handle.name),
    [
      "verifyJwtToken",
      "verifyWidgetSessionProvisioning",
      "",
      "createWidgetSessionController",
    ]
  );
  assert.deepEqual(
    deleteSessionRoute?.stack.map(layer => layer.handle.name),
    [
      "verifyJwtToken",
      "verifyWidgetSessionProvisioning",
      "",
      "deleteWidgetSessionController",
    ]
  );
  assert.deepEqual(
    moodRoute?.stack.map(layer => layer.handle.name),
    ["verifyWidgetToken", "", "logWidgetMoodController"]
  );
});
