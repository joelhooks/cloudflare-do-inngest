import { EventSchemas } from "inngest";

type DemoEvent = {
  name: "demo/event.sent";
  data: {
    message: string;
  };
};

export type InngestEvents =
  | DemoEvent;

export const schemas = new EventSchemas().fromUnion<InngestEvents>();